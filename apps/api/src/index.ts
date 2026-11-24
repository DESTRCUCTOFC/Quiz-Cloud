import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render.com')
    ? { rejectUnauthorized: false }
    : false,
});

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

interface OptionInput {
  option_text?: unknown;
  is_correct?: unknown;
}

interface QuestionInput {
  question_text?: unknown;
  points?: unknown;
  options?: unknown;
}

interface AnswerInput {
  question_id?: unknown;
  selected_option_id?: unknown;
}

const parsePositiveId = (raw: unknown): number | null => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const dbCheck = await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      service: 'QuizCloud API (Express 5)',
      dbTime: dbCheck.rows[0].now,
    });
  } catch (error) {
    console.error('Healthcheck error:', error);
    res.status(500).json({ status: 'error', message: 'Sin conexión a PostgreSQL' });
  }
});

// Acceso por rol usando la tabla users (sin contraseñas para MVP)
app.post('/api/users/access', async (req: Request, res: Response) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const role = req.body?.role;

  if (name.length < 2 || name.length > 100) {
    res.status(400).json({ error: 'El nombre debe tener entre 2 y 100 caracteres.' });
    return;
  }
  if (!email || !email.includes('@') || email.length > 150) {
    res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
    return;
  }
  if (role !== 'teacher' && role !== 'student') {
    res.status(400).json({ error: 'El rol debe ser teacher o student.' });
    return;
  }

  try {
    const existing = await pool.query(
      'SELECT id, name, email, role FROM users WHERE email = $1',
      [email]
    );

    if ((existing.rowCount ?? 0) > 0) {
      const user = existing.rows[0];
      if (user.role !== role) {
        res.status(403).json({
          error: `Este correo ya está registrado como ${user.role === 'teacher' ? 'Profesor' : 'Estudiante'}.`,
        });
        return;
      }
      res.json({ user });
      return;
    }

    const created = await pool.query(
      'INSERT INTO users (name, email, role) VALUES ($1, $2, $3) RETURNING id, name, email, role',
      [name, email, role]
    );
    res.status(201).json({ user: created.rows[0] });
  } catch (error) {
    console.error('Error en acceso de usuario:', error);
    res.status(500).json({ error: 'Error al validar el usuario.' });
  }
});


// Listar cuestionarios con conteo de preguntas e intentos
app.get('/api/quizzes', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT q.id,
             q.title,
             q.description,
             q.created_at,
             COUNT(DISTINCT qu.id)::int AS question_count,
             COUNT(DISTINCT a.id)::int AS attempt_count
      FROM quizzes q
      LEFT JOIN questions qu ON qu.quiz_id = q.id
      LEFT JOIN attempts a ON a.quiz_id = q.id
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener cuestionarios:', error);
    res.status(500).json({ error: 'Error al obtener cuestionarios.' });
  }
});

// Obtener un cuestionario para resolver (Regla 1: NO envía is_correct antes de finalizar)
app.get('/api/quizzes/:id', async (req: Request, res: Response) => {
  const quizId = parsePositiveId(req.params.id);
  if (!quizId) {
    res.status(400).json({ error: 'El ID del cuestionario debe ser un entero positivo.' });
    return;
  }

  try {
    const quizRes = await pool.query(
      'SELECT id, title, description, created_at FROM quizzes WHERE id = $1',
      [quizId]
    );

    if (quizRes.rowCount === 0) {
      res.status(404).json({ error: 'Cuestionario no encontrado.' });
      return;
    }

    const questionsRes = await pool.query(
      'SELECT id, question_text, points FROM questions WHERE quiz_id = $1 ORDER BY id ASC',
      [quizId]
    );

    const optionsRes = await pool.query(
      `SELECT o.id, o.question_id, o.option_text
       FROM options o
       INNER JOIN questions qu ON qu.id = o.question_id
       WHERE qu.quiz_id = $1
       ORDER BY o.id ASC`,
      [quizId]
    );

    const optionsByQuestion = new Map<number, Array<{ id: number; option_text: string }>>();
    for (const opt of optionsRes.rows) {
      const list = optionsByQuestion.get(opt.question_id) || [];
      list.push({ id: opt.id, option_text: opt.option_text });
      optionsByQuestion.set(opt.question_id, list);
    }

    const questions = questionsRes.rows.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      points: q.points,
      options: optionsByQuestion.get(q.id) || [],
    }));

    res.json({
      ...quizRes.rows[0],
      questions,
    });
  } catch (error) {
    console.error('Error al obtener detalle del cuestionario:', error);
    res.status(500).json({ error: 'Error al obtener el cuestionario.' });
  }
});

// Crear cuestionario con validaciones completas
app.post('/api/quizzes', async (req: Request, res: Response) => {
  const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const rawDescription =
    typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const rawQuestions = req.body?.questions;

  if (rawTitle.length < 3 || rawTitle.length > 200) {
    res.status(400).json({ error: 'El título debe tener entre 3 y 200 caracteres.' });
    return;
  }

  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    res.status(400).json({ error: 'Debes agregar al menos una pregunta.' });
    return;
  }

  const normalizedQuestions: Array<{
    question_text: string;
    points: number;
    options: Array<{ option_text: string; is_correct: boolean }>;
  }> = [];

  for (let i = 0; i < rawQuestions.length; i++) {
    const q = rawQuestions[i] as QuestionInput;
    const questionText =
      typeof q?.question_text === 'string' ? q.question_text.trim() : '';

    if (!questionText) {
      res.status(400).json({ error: `La pregunta ${i + 1} no puede estar vacía.` });
      return;
    }

    const points = q?.points === undefined ? 10 : Number(q.points);
    if (!Number.isInteger(points) || points <= 0 || points > 100) {
      res.status(400).json({
        error: `Los puntos de la pregunta ${i + 1} deben ser un entero entre 1 y 100.`,
      });
      return;
    }

    if (!Array.isArray(q?.options) || q.options.length < 2) {
      res.status(400).json({
        error: `La pregunta ${i + 1} debe tener al menos 2 opciones.`,
      });
      return;
    }

    const normalizedOptions: Array<{ option_text: string; is_correct: boolean }> = [];
    for (let j = 0; j < q.options.length; j++) {
      const opt = q.options[j] as OptionInput;
      const optionText =
        typeof opt?.option_text === 'string' ? opt.option_text.trim() : '';

      if (!optionText) {
        res.status(400).json({
          error: `La opción ${j + 1} de la pregunta ${i + 1} no puede estar vacía.`,
        });
        return;
      }

      normalizedOptions.push({
        option_text: optionText,
        is_correct: Boolean(opt?.is_correct),
      });
    }

    const correctCount = normalizedOptions.filter((opt) => opt.is_correct).length;
    if (correctCount !== 1) {
      res.status(400).json({
        error: `La pregunta ${i + 1} debe tener exactamente una opción marcada como correcta.`,
      });
      return;
    }

    normalizedQuestions.push({
      question_text: questionText,
      points,
      options: normalizedOptions,
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const teacherId = parsePositiveId(req.body?.teacher_id) || 1;
    const quizRes = await client.query(
      'INSERT INTO quizzes (title, description, teacher_id) VALUES ($1, $2, $3) RETURNING id, title, description, created_at',
      [rawTitle, rawDescription, teacherId]
    );

    const quizId = quizRes.rows[0].id;

    for (const q of normalizedQuestions) {
      const questionRes = await client.query(
        'INSERT INTO questions (quiz_id, question_text, points) VALUES ($1, $2, $3) RETURNING id',
        [quizId, q.question_text, q.points]
      );
      const questionId = questionRes.rows[0].id;

      for (const opt of q.options) {
        await client.query(
          'INSERT INTO options (question_id, option_text, is_correct) VALUES ($1, $2, $3)',
          [questionId, opt.option_text, opt.is_correct]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Cuestionario creado', quiz: quizRes.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al guardar el cuestionario:', error);
    res.status(500).json({ error: 'Error interno al guardar el cuestionario.' });
  } finally {
    client.release();
  }
});

// Eliminar cuestionario
app.delete('/api/quizzes/:id', async (req: Request, res: Response) => {
  const quizId = parsePositiveId(req.params.id);
  if (!quizId) {
    res.status(400).json({ error: 'El ID del cuestionario debe ser un entero positivo.' });
    return;
  }

  try {
    const result = await pool.query(
      'DELETE FROM quizzes WHERE id = $1 RETURNING id, title',
      [quizId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Cuestionario no encontrado.' });
      return;
    }

    res.json({
      message: 'Cuestionario eliminado correctamente.',
      deleted: result.rows[0],
    });
  } catch (error) {
    console.error('Error al eliminar cuestionario:', error);
    res.status(500).json({ error: 'Error al eliminar el cuestionario.' });
  }
});


const handleCreateAttempt = async (req: Request, res: Response) => {
  const quizId = parsePositiveId(req.params.id ?? req.body?.quiz_id);
  if (!quizId) {
    res.status(400).json({ error: 'El ID del cuestionario (quiz_id) debe ser un entero positivo.' });
    return;
  }

  const studentName =
    typeof req.body?.student_name === 'string' ? req.body.student_name.trim() : '';
  const rawAnswers = req.body?.answers;

  if (studentName.length < 2 || studentName.length > 100) {
    res.status(400).json({
      error: 'El nombre del estudiante debe tener entre 2 y 100 caracteres.',
    });
    return;
  }

  if (!Array.isArray(rawAnswers) || rawAnswers.length === 0) {
    res.status(400).json({ error: 'Debes enviar al menos una respuesta.' });
    return;
  }

  const submittedMap = new Map<number, number>();
  for (const item of rawAnswers as AnswerInput[]) {
    const questionId = parsePositiveId(item?.question_id);
    const optionId = parsePositiveId(item?.selected_option_id);

    if (!questionId || !optionId) {
      res.status(400).json({ error: 'Formato inválido en las respuestas enviadas.' });
      return;
    }
    submittedMap.set(questionId, optionId);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const quizRes = await client.query('SELECT id, title FROM quizzes WHERE id = $1', [quizId]);
    if (quizRes.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Cuestionario no encontrado.' });
      return;
    }

    const questionsRes = await client.query(
      'SELECT id, question_text, points FROM questions WHERE quiz_id = $1 ORDER BY id ASC',
      [quizId]
    );

    if (questionsRes.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Este cuestionario no tiene preguntas configuradas.' });
      return;
    }

    const optionsRes = await client.query(
      `SELECT o.id, o.question_id, o.option_text, o.is_correct
       FROM options o
       INNER JOIN questions qu ON qu.id = o.question_id
       WHERE qu.quiz_id = $1`,
      [quizId]
    );

    const optionsByQuestion = new Map<
      number,
      Array<{ id: number; option_text: string; is_correct: boolean }>
    >();

    for (const opt of optionsRes.rows) {
      const list = optionsByQuestion.get(opt.question_id) || [];
      list.push({
        id: opt.id,
        option_text: opt.option_text,
        is_correct: Boolean(opt.is_correct),
      });
      optionsByQuestion.set(opt.question_id, list);
    }

    let totalPoints = 0;
    let earnedPoints = 0;
    let correctCount = 0;

    const details: Array<{
      question_id: number;
      question_text: string;
      selected_option_id: number;
      selected_option_text: string;
      correct_option_text: string;
      is_correct: boolean;
      points_earned: number;
      points_possible: number;
    }> = [];

    for (const q of questionsRes.rows) {
      const selectedOptionId = submittedMap.get(q.id);
      if (!selectedOptionId) {
        await client.query('ROLLBACK');
        res.status(400).json({
          error: 'Debes responder todas las preguntas del cuestionario antes de enviar.',
        });
        return;
      }

      const qOptions = optionsByQuestion.get(q.id) || [];
      const chosenOption = qOptions.find((opt) => opt.id === selectedOptionId);
      if (!chosenOption) {
        await client.query('ROLLBACK');
        res.status(400).json({
          error: `La opción seleccionada para la pregunta "${q.question_text}" no es válida.`,
        });
        return;
      }

      const correctOption = qOptions.find((opt) => opt.is_correct);
      const isCorrect = chosenOption.is_correct;
      const pointsPossible = Number(q.points);
      const pointsEarned = isCorrect ? pointsPossible : 0;

      totalPoints += pointsPossible;
      earnedPoints += pointsEarned;
      if (isCorrect) correctCount += 1;

      details.push({
        question_id: q.id,
        question_text: q.question_text,
        selected_option_id: chosenOption.id,
        selected_option_text: chosenOption.option_text,
        correct_option_text: correctOption?.option_text || '',
        is_correct: isCorrect,
        points_earned: pointsEarned,
        points_possible: pointsPossible,
      });
    }

    const score =
      totalPoints > 0 ? Number(((earnedPoints / totalPoints) * 100).toFixed(2)) : 0;

    const studentId = parsePositiveId(req.body?.student_id);
    const attemptRes = await client.query(
      `INSERT INTO attempts (quiz_id, student_id, student_name, score, status)
       VALUES ($1, $2, $3, $4, 'completed')
       RETURNING id, quiz_id, student_id, student_name, score, status, completed_at`,
      [quizId, studentId, studentName, score]
    );

    const attempt = attemptRes.rows[0];

    for (const item of details) {
      await client.query(
        'INSERT INTO answers (attempt_id, question_id, selected_option_id) VALUES ($1, $2, $3)',
        [attempt.id, item.question_id, item.selected_option_id]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Intento guardado y calificado correctamente.',
      attempt: {
        ...attempt,
        score: Number(attempt.score),
        quiz_title: quizRes.rows[0].title,
      },
      summary: {
        earned_points: earnedPoints,
        total_points: totalPoints,
        correct_count: correctCount,
        total_questions: questionsRes.rows.length,
        score,
      },
      details,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar intento:', error);
    res.status(500).json({ error: 'Error interno al guardar el intento.' });
  } finally {
    client.release();
  }
};

app.post('/api/attempts', handleCreateAttempt);
app.post('/api/quizzes/:id/attempts', handleCreateAttempt);

// Listar intentos guardados
app.get('/api/attempts', async (req: Request, res: Response) => {
  const quizIdQuery = req.query.quiz_id;
  let filterQuizId: number | null = null;

  if (quizIdQuery !== undefined) {
    filterQuizId = parsePositiveId(String(quizIdQuery));
    if (!filterQuizId) {
      res.status(400).json({ error: 'El parámetro quiz_id debe ser un entero positivo.' });
      return;
    }
  }

  try {
      const queryText = filterQuizId
      ? `SELECT a.id, a.quiz_id, a.student_id, q.title AS quiz_title, a.student_name, a.score, a.status, a.completed_at
         FROM attempts a
         INNER JOIN quizzes q ON q.id = a.quiz_id
         WHERE a.quiz_id = $1
         ORDER BY a.completed_at DESC
         LIMIT 50`
      : `SELECT a.id, a.quiz_id, a.student_id, q.title AS quiz_title, a.student_name, a.score, a.status, a.completed_at
         FROM attempts a
         INNER JOIN quizzes q ON q.id = a.quiz_id
         ORDER BY a.completed_at DESC
         LIMIT 50`;


    const result = filterQuizId
      ? await pool.query(queryText, [filterQuizId])
      : await pool.query(queryText);

    res.json(
      result.rows.map((row) => ({
        ...row,
        score: Number(row.score),
      }))
    );
  } catch (error) {
    console.error('Error al obtener intentos:', error);
    res.status(500).json({ error: 'Error al consultar el historial de intentos.' });
  }
});

// Un intento finalizado no puede alterarse sin registro
app.all('/api/attempts/:attemptId', async (req: Request, res: Response) => {
  const attemptId = parsePositiveId(req.params.attemptId);
  if (!attemptId) {
    res.status(400).json({ error: 'El ID del intento debe ser un entero positivo.' });
    return;
  }

  try {
    const existing = await pool.query('SELECT id, status FROM attempts WHERE id = $1', [attemptId]);
    if (existing.rowCount === 0) {
      res.status(404).json({ error: 'Intento no encontrado.' });
      return;
    }

    if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
      res.status(403).json({
        error: 'Un intento finalizado es inmutable y no puede alterarse sin registro.',
      });
      return;
    }

    res.status(405).json({ error: 'Método no permitido en este recurso.' });
  } catch (error) {
    console.error('Error validando intento:', error);
    res.status(500).json({ error: 'Error interno al validar el intento.' });
  }
});

// consultar resultado individual de un intento
app.get('/api/results/:attemptId', async (req: Request, res: Response) => {
  const attemptId = parsePositiveId(req.params.attemptId);
  if (!attemptId) {
    res.status(400).json({ error: 'El ID del intento debe ser un entero positivo.' });
    return;
  }

  try {
    const attemptRes = await pool.query(
      `SELECT a.id, a.quiz_id, q.title AS quiz_title, a.student_name, a.score, a.status, a.completed_at
       FROM attempts a
       INNER JOIN quizzes q ON q.id = a.quiz_id
       WHERE a.id = $1`,
      [attemptId]
    );

    if (attemptRes.rowCount === 0) {
      res.status(404).json({ error: 'Resultado de intento no encontrado.' });
      return;
    }

    const answersRes = await pool.query(
      `SELECT ans.question_id,
              qu.question_text,
              qu.points AS points_possible,
              ans.selected_option_id,
              sel.option_text AS selected_option_text,
              sel.is_correct,
              cor.option_text AS correct_option_text
       FROM answers ans
       INNER JOIN questions qu ON qu.id = ans.question_id
       INNER JOIN options sel ON sel.id = ans.selected_option_id
       LEFT JOIN options cor ON cor.question_id = qu.id AND cor.is_correct = TRUE
       WHERE ans.attempt_id = $1
       ORDER BY qu.id ASC`,
      [attemptId]
    );

    let totalPoints = 0;
    let earnedPoints = 0;
    let correctCount = 0;

    const details = answersRes.rows.map((row) => {
      const isCorrect = Boolean(row.is_correct);
      const pointsPossible = Number(row.points_possible);
      const pointsEarned = isCorrect ? pointsPossible : 0;

      totalPoints += pointsPossible;
      earnedPoints += pointsEarned;
      if (isCorrect) correctCount += 1;

      return {
        question_id: row.question_id,
        question_text: row.question_text,
        selected_option_id: row.selected_option_id,
        selected_option_text: row.selected_option_text,
        correct_option_text: row.correct_option_text || '',
        is_correct: isCorrect,
        points_earned: pointsEarned,
        points_possible: pointsPossible,
      };
    });

    const attempt = attemptRes.rows[0];
    res.json({
      attempt: {
        ...attempt,
        score: Number(attempt.score),
      },
      summary: {
        earned_points: earnedPoints,
        total_points: totalPoints,
        correct_count: correctCount,
        total_questions: details.length,
        score: Number(attempt.score),
      },
      details,
    });
  } catch (error) {
    console.error('Error al obtener resultado individual:', error);
    res.status(500).json({ error: 'Error al consultar el resultado del intento.' });
  }
});

// Ruta no encontrada
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Ruta no encontrada en QuizCloud API.' });
});

// Manejo global de errores (ej. JSON mal formado)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido.' });
    return;
  }
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`API de QuizCloud corriendo en el puerto ${PORT}`);
});
