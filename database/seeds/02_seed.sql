INSERT INTO users (name, email, role) VALUES
('Prof. Juan Pablo', 'profesor@ugto.mx', 'teacher'),
('Alumno Demo', 'alumno@ugto.mx', 'student')
ON CONFLICT (email) DO NOTHING;

INSERT INTO quizzes (title, description, teacher_id) VALUES
('Conceptos de Cómputo en la Nube', 'Evaluación diagnóstica sobre contenedores, CI/CD y despliegue.', 1);

INSERT INTO questions (quiz_id, question_text, points) VALUES
(1, '¿Qué archivo utiliza Render en producción para construir el backend de este proyecto?', 10);

INSERT INTO options (question_id, option_text, is_correct) VALUES
(1, 'compose.yaml', FALSE),
(1, 'docker/api.Dockerfile', TRUE),
(1, 'netlify.toml', FALSE);
