import express, { Request, Response } from 'express';
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

app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    const dbCheck = await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      service: 'QuizCloud API (Express 5)',
      dbTime: dbCheck.rows[0].now
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Sin conexión a PostgreSQL' });
  }
});

app.get('/api/quizzes', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT q.id, q.title, q.description, q.created_at,
             COUNT(qu.id)::int AS question_count
      FROM quizzes q
      LEFT JOIN questions qu ON qu.quiz_id = q.id
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener cuestionarios' });
  }
});

app.post('/api/quizzes', async (req: Request, res: Response) => {
  const { title, description, questions } = req.body;

  if (!title || !Array.isArray(questions) || questions.length === 0) {
    res.status(400).json({ error: 'El título y al menos una pregunta son obligatorios.' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const quizRes = await client.query(
      'INSERT INTO quizzes (title, description, teacher_id) VALUES ($1, $2, 1) RETURNING id, title, description',
      [title, description || '']
    );
    const quizId = quizRes.rows[0].id;

    for (const q of questions) {
      if (!q.question_text || !Array.isArray(q.options) || q.options.length < 2) {
        throw new Error('Cada pregunta debe tener texto y al menos 2 opciones.');
      }

      const questionRes = await client.query(
        'INSERT INTO questions (quiz_id, question_text, points) VALUES ($1, $2, $3) RETURNING id',
        [quizId, q.question_text, q.points || 1]
      );
      const questionId = questionRes.rows[0].id;

      for (const opt of q.options) {
        await client.query(
          'INSERT INTO options (question_id, option_text, is_correct) VALUES ($1, $2, $3)',
          [questionId, opt.option_text, Boolean(opt.is_correct)]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Cuestionario creado', quiz: quizRes.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message || 'Error al guardar el cuestionario' });
  } finally {
    client.release();
  }
});

app.listen(PORT, () => {
  console.log(`API de QuizCloud corriendo en el puerto ${PORT}`);
});
