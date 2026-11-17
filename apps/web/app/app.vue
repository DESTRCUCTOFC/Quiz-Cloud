<template>
    <div class="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
        <div class="max-w-4xl mx-auto space-y-8">
            <header class="border-b border-slate-700 pb-4 flex justify-between items-center">
                <div>
                    <h1 class="text-3xl font-bold text-indigo-400">QuizCloud</h1>
                    <p class="text-slate-400 text-sm">Diseñar Cuestionario 📑 </p>
                </div>
            </header>
            <section class="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
                <h2 class="text-xl font-semibold text-white">Crear Nuevo Cuestionario</h2>
                <div class="grid gap-4">
                    <input 
                        v-model="newQuiz.title" 
                        type="text" 
                        placeholder="Título del examen (ej. Parcial 1 Cómputo en la Nube)" 
                        class="w-full p-3 rounded bg-slate-900 border border-slate-700 text-white" 
                    />
                    <textarea 
                        v-model="newQuiz.description" 
                        placeholder="Descripción o instrucciones para el alumno..." 
                        class="w-full p-3 rounded bg-slate-900 border border-slate-700 text-white"
                    ></textarea>
                </div>
                <div v-for="(q, qIndex) in newQuiz.questions" :key="qIndex" class="p-4 bg-slate-900 rounded-lg border border-slate-700 space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="font-medium text-indigo-300">Pregunta {{ qIndex + 1 }}</span>
                    </div>
                    <input 
                        v-model="q.question_text" 
                        type="text" 
                        placeholder="Escribe la pregunta aquí..." 
                        class="w-full p-2 rounded bg-slate-800 border border-slate-600 text-white" 
                    />
                    <div class="space-y-2 pl-4 border-l-2 border-indigo-500">
                        <div v-for="(opt, oIndex) in q.options" :key="oIndex" class="flex items-center gap-3">
                            <input 
                                type="radio" 
                                :name="'correct-' + qIndex" 
                                :checked="opt.is_correct" 
                                @change="setCorrectOption(qIndex, oIndex)" 
                            />
                            <input 
                                v-model="opt.option_text" 
                                type="text" 
                                :placeholder="'Opción ' + (oIndex + 1)" 
                                class="flex-1 p-2 rounded bg-slate-800 border border-slate-700 text-sm text-white" 
                            />
                            <span v-if="opt.is_correct" class="text-xs text-emerald-400 font-semibold">Correcta</span>
                        </div>
                    </div>
                </div>
                <div class="flex gap-4 pt-2">
                    <button @click="addQuestion" type="button" class="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm font-medium">
                        Agregar Pregunta 
                    </button>
                    <button @click="saveQuiz" type="button" class="px-6 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
                        Guardar Cuestionario 🔄
                    </button>
                </div>
                <p v-if="feedback" class="text-sm text-emerald-400 pt-2">{{ feedback }}</p>
            </section>

            <section class="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
                <h2 class="text-xl font-semibold text-white">Cuestionarios Diseñados({{ quizzes.length }})</h2>
                <div v-if="quizzes.length === 0" class="text-slate-400 text-sm">Cargando cuestionarios...</div>
                <div class="grid gap-3">
                    <div v-for="quiz in quizzes" :key="quiz.id" class="p-4 bg-slate-900 rounded-lg border border-slate-700 flex justify-between items-center">
                        <div>
                            <h3 class="font-bold text-indigo-300">{{ quiz.title }}</h3>
                            <p class="text-sm text-slate-400">{{ quiz.description }}</p>
                        </div>
                        <span class="px-3 py-1 bg-slate-800 rounded text-xs text-slate-300">
                            {{ quiz.question_count }} preguntas
                        </span>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig();
const apiBase = config.public.apiBase;

const quizzes = ref<any[]>([]);
const feedback = ref('');

const createBlankQuestion = () => ({
    question_text: '',
    points: 10,
    options: [
        { option_text: '', is_correct: true },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false }
    ]
});

const newQuiz = reactive({
    title: '',
    description: '',
    questions: [createBlankQuestion()]
});

const addQuestion = () => {
    newQuiz.questions.push(createBlankQuestion());
};

const setCorrectOption = (qIndex: number, oIndex: number) => {
    newQuiz.questions[qIndex].options.forEach((opt, idx) => {
    opt.is_correct = idx === oIndex;
    });
};

const fetchQuizzes = async () => {
    try {
        quizzes.value = await $fetch(`${apiBase}/api/quizzes`);
    } catch (e) {
        console.error('Error cargando quizzes:', e);
    }
};

const saveQuiz = async () => {
    feedback.value = '';
    try {
        await $fetch(`${apiBase}/api/quizzes`, {
        method: 'POST',
        body: newQuiz
        });
        feedback.value = '¡Cuestionario guardado exitosamente en PostgreSQL!';
        newQuiz.title = '';
        newQuiz.description = '';
        newQuiz.questions = [createBlankQuestion()];
        await fetchQuizzes();
    } catch (err: any) {
        feedback.value = 'Error al guardar: llena todos los campos de las preguntas y opciones.';
    }
};

onMounted(fetchQuizzes);
</script>