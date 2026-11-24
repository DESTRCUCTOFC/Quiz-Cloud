<template>
    <div class="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
        <!-- PANTALLA DE ACCESO POR ROL -->
        <div v-if="!currentUser" class="max-w-md mx-auto mt-12 bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-5">
            <div class="text-center">
                <h1 class="text-3xl font-bold text-indigo-400">QuizCloud</h1>
                <p class="text-slate-400 text-sm mt-1">
                    {{ pendingQuizId ? `Ingresa como estudiante para contestar el examen #${pendingQuizId}` : 'Selecciona tu rol para continuar' }}
                </p>
            </div>

            <div class="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    @click="loginForm.role = 'student'"
                    :class="loginForm.role === 'student' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400'"
                    class="py-2.5 rounded-lg text-sm font-semibold border border-slate-700"
                >
                    Estudiante
                </button>
                <button
                    type="button"
                    @click="loginForm.role = 'teacher'"
                    :class="loginForm.role === 'teacher' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400'"
                    class="py-2.5 rounded-lg text-sm font-semibold border border-slate-700"
                >
                    Profesor
                </button>
            </div>

            <div class="space-y-3">
                <input
                    v-model="loginForm.name"
                    type="text"
                    placeholder="Tu nombre completo"
                    class="w-full p-3 rounded bg-slate-900 border border-slate-700 text-white"
                />
                <input
                    v-model="loginForm.email"
                    type="email"
                    placeholder="Tu correo electrónico"
                    class="w-full p-3 rounded bg-slate-900 border border-slate-700 text-white"
                />
            </div>

            <p v-if="loginError" class="text-sm text-rose-400">{{ loginError }}</p>

            <button
                type="button"
                :disabled="isLoggingIn"
                @click="enterApp"
                class="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold"
            >
                {{ isLoggingIn ? 'Entrando...' : 'Entrar a QuizCloud' }}
            </button>
        </div>

        <div v-else class="max-w-4xl mx-auto space-y-8">
            <header class="border-b border-slate-700 pb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 class="text-3xl font-bold text-indigo-400">QuizCloud</h1>
                    <p class="text-slate-400 text-sm">
                        {{ currentUser.role === 'teacher' ? 'Diseñar Cuestionario 📑' : 'Resolver Cuestionarios 📝' }}
                    </p>
                </div>

                <nav class="flex flex-wrap items-center gap-2">
                    <template v-if="currentUser.role === 'teacher'">
                        <button
                            type="button"
                            @click="activeTab = 'manage'"
                            :class="activeTab === 'manage' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'"
                            class="px-4 py-2 rounded-lg text-sm font-medium"
                        >
                            Mis Cuestionarios
                        </button>
                        <button
                            type="button"
                            @click="openHistoryTab"
                            :class="activeTab === 'history' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'"
                            class="px-4 py-2 rounded-lg text-sm font-medium"
                        >
                            Resultados ({{ visibleAttempts.length }})
                        </button>
                    </template>

                    <template v-else>
                        <button
                            type="button"
                            @click="activeTab = 'take'"
                            :class="activeTab === 'take' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'"
                            class="px-4 py-2 rounded-lg text-sm font-medium"
                        >
                            Contestar
                        </button>
                        <button
                            type="button"
                            @click="openHistoryTab"
                            :class="activeTab === 'history' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'"
                            class="px-4 py-2 rounded-lg text-sm font-medium"
                        >
                            Mis Resultados ({{ visibleAttempts.length }})
                        </button>
                    </template>

                    <span class="text-xs text-slate-400 px-2">
                        {{ currentUser.name }} ({{ currentUser.role === 'teacher' ? 'Profesor' : 'Estudiante' }})
                    </span>
                    <button
                        type="button"
                        @click="logout"
                        class="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-rose-300 border border-slate-700"
                    >
                        Salir
                    </button>
                </nav>
            </header>

            <!-- VISTA PROFESOR: CREAR Y GESTIONAR -->
            <div v-if="activeTab === 'manage' && currentUser.role === 'teacher'" class="space-y-8">
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
                        <button @click="saveQuiz" :disabled="isSaving" type="button" class="px-6 py-2 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold">
                            {{ isSaving ? 'Guardando...' : 'Guardar Cuestionario 🔄' }}
                        </button>
                    </div>
                    <p v-if="feedback" :class="isError ? 'text-rose-400' : 'text-emerald-400'" class="text-sm pt-2">{{ feedback }}</p>
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
                            <div class="flex items-center gap-2">
                                <span class="px-3 py-1 bg-slate-800 rounded text-xs text-slate-300">
                                    {{ quiz.question_count }} preguntas
                                </span>
                                <button @click="copyQuizLink(quiz.id)" type="button" class="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white">
                                    {{ copiedQuizId === quiz.id ? '¡Link copiado!' : 'Copiar link' }}
                                </button>
                                <button @click="deleteQuiz(quiz.id, quiz.title)" type="button" class="px-3 py-1.5 rounded bg-rose-900 hover:bg-rose-800 text-xs text-rose-200">
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <!-- VISTA ALUMNO: CONTESTAR -->
            <section v-else-if="activeTab === 'take'" class="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-5">
                <h2 class="text-xl font-semibold text-white">Contestar Cuestionario</h2>
                <p v-if="takeError" class="text-sm text-rose-400">{{ takeError }}</p>

                <div v-if="!activeQuiz" class="space-y-3">
                    <p class="text-sm text-slate-400">Selecciona un cuestionario disponible para responder:</p>
                    <div v-if="quizzes.length === 0" class="text-sm text-slate-500">No hay cuestionarios disponibles.</div>
                    <div v-for="quiz in quizzes" :key="quiz.id" class="p-4 bg-slate-900 rounded-lg border border-slate-700 flex justify-between items-center">
                        <div>
                            <h3 class="font-bold text-indigo-300">{{ quiz.title }}</h3>
                            <p class="text-sm text-slate-400">{{ quiz.description }}</p>
                        </div>
                        <button @click="startQuiz(quiz.id)" type="button" class="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white">
                            Iniciar
                        </button>
                    </div>
                </div>

                <!-- Resultado calificado por el backend -->
                <div v-else-if="attemptResult" class="space-y-4">
                    <div class="p-4 bg-slate-900 rounded-lg border border-emerald-600 space-y-1">
                        <h3 class="text-xl font-bold text-emerald-400">
                            Calificación: {{ attemptResult.summary.score }} / 100
                        </h3>
                        <p class="text-sm text-slate-300">
                            Alumno: {{ attemptResult.attempt.student_name }} ({{ attemptResult.summary.correct_count }}/{{ attemptResult.summary.total_questions }} correctas)
                        </p>
                    </div>
                    <div v-for="(item, idx) in attemptResult.details" :key="item.question_id" class="p-3 bg-slate-900 rounded-lg border border-slate-700 text-sm">
                        <p class="font-medium text-white">{{ idx + 1 }}. {{ item.question_text }}</p>
                        <p :class="item.is_correct ? 'text-emerald-400' : 'text-rose-400'">
                            Tu respuesta: {{ item.selected_option_text }} ({{ item.is_correct ? 'Correcta' : 'Incorrecta' }})
                        </p>
                        <p v-if="!item.is_correct" class="text-emerald-300">Correcta: {{ item.correct_option_text }}</p>
                    </div>
                    <div class="flex gap-3">
                        <button @click="resetAttempt" type="button" class="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold">
                            Contestar de nuevo
                        </button>
                        <button @click="activeQuiz = null" type="button" class="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm font-medium">
                            Ver otros cuestionarios
                        </button>
                    </div>
                </div>

                <!-- Formulario de preguntas -->
                <div v-else class="space-y-4">
                    <div class="flex justify-between items-start gap-4">
                        <div>
                            <h3 class="text-lg font-bold text-indigo-300">{{ activeQuiz.title }}</h3>
                            <p class="text-sm text-slate-400">{{ activeQuiz.description }}</p>
                        </div>
                        <button @click="activeQuiz = null" type="button" class="text-xs text-slate-400 hover:text-white">
                            ← Cambiar
                        </button>
                    </div>
                    <input
                        v-model="studentName"
                        type="text"
                        placeholder="Escribe tu nombre completo..."
                        class="w-full p-3 rounded bg-slate-900 border border-slate-700 text-white"
                    />
                    <div v-for="(q, qIndex) in activeQuiz.questions" :key="q.id" class="p-4 bg-slate-900 rounded-lg border border-slate-700 space-y-2">
                        <p class="font-medium text-white">{{ qIndex + 1 }}. {{ q.question_text }}</p>
                        <label v-for="opt in q.options" :key="opt.id" class="flex items-center gap-3 p-2 rounded bg-slate-800 cursor-pointer text-sm">
                            <input type="radio" :name="'ans-' + q.id" :value="opt.id" v-model="selectedAnswers[q.id]" />
                            <span>{{ opt.option_text }}</span>
                        </label>
                    </div>
                    <button @click="submitAttempt" :disabled="isSubmitting" type="button" class="px-6 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold">
                        {{ isSubmitting ? 'Calificando...' : 'Enviar Respuestas' }}
                    </button>
                </div>
            </section>

            <!-- VISTA HISTORIAL DE RESULTADOS -->
            <section v-else class="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
                <h2 class="text-xl font-semibold text-white">Resultados Guardados</h2>
                <div v-if="visibleAttempts.length === 0" class="text-sm text-slate-400">Aún no hay intentos registrados.</div>
                <div v-else class="space-y-3">
                    <div v-for="item in visibleAttempts" :key="item.id" class="p-4 bg-slate-900 rounded-lg border border-slate-700 flex justify-between items-center">
                        <div>
                            <p class="font-bold text-white">{{ item.student_name }}</p>
                            <p class="text-sm text-indigo-300">{{ item.quiz_title }}</p>
                        </div>
                        <div class="flex items-center gap-3">
                            <span class="px-3 py-1 rounded bg-slate-800 text-sm font-semibold text-emerald-400">
                                {{ item.score }}%
                            </span>
                            <button @click="viewIndividualResult(item.id)" type="button" class="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-xs text-white">
                                Ver detalle
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Panel de resultado individual -->
                <div v-if="individualResult" class="p-4 bg-slate-900 rounded-lg border border-indigo-500 space-y-2 mt-4">
                    <div class="flex justify-between items-center">
                        <h3 class="font-semibold text-indigo-300">
                            Detalle Intento #{{ individualResult.attempt.id }} — {{ individualResult.attempt.student_name }} ({{ individualResult.summary.score }}%)
                        </h3>
                        <button @click="individualResult = null" type="button" class="text-xs text-slate-400">Cerrar ✕</button>
                    </div>
                    <div v-for="(d, i) in individualResult.details" :key="d.question_id" class="text-sm border-t border-slate-800 pt-2">
                        <p class="text-white">{{ i + 1 }}. {{ d.question_text }}</p>
                        <p :class="d.is_correct ? 'text-emerald-400' : 'text-rose-400'">
                            Eligió: {{ d.selected_option_text }}
                        </p>
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
const activeTab = ref<'manage' | 'take' | 'history'>('manage');
const isSaving = ref(false);
const isError = ref(false);

const activeQuiz = ref<any>(null);
const studentName = ref('');
const selectedAnswers = reactive<Record<number, number>>({});
const isSubmitting = ref(false);
const takeError = ref('');
const attemptResult = ref<any>(null);

const attempts = ref<any[]>([]);
const individualResult = ref<any>(null);

const currentUser = ref<{ id: number; name: string; email: string; role: 'teacher' | 'student' } | null>(null);
const loginForm = reactive({ name: '', email: '', role: 'student' as 'teacher' | 'student' });
const loginError = ref('');
const isLoggingIn = ref(false);
const pendingQuizId = ref<number>(0);
const copiedQuizId = ref<number | null>(null);

const visibleAttempts = computed(() => {
    if (!currentUser.value) return [];
    if (currentUser.value.role === 'teacher') return attempts.value;
    return attempts.value.filter(
        (a: any) =>
            a.student_id === currentUser.value?.id ||
            a.student_name?.toLowerCase() === currentUser.value?.name.toLowerCase()
    );
});

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
    const question = newQuiz.questions[qIndex];
    if (!question) return;
    question.options.forEach((opt, idx) => {
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

const fetchAttempts = async () => {
    try {
        attempts.value = await $fetch(`${apiBase}/api/attempts`);
    } catch (e) {
        console.error('Error cargando intentos:', e);
    }
};

const enterApp = async () => {
    if (isLoggingIn.value) return;
    loginError.value = '';
    isLoggingIn.value = true;
    try {
        const res: any = await $fetch(`${apiBase}/api/users/access`, {
            method: 'POST',
            body: loginForm
        });
        currentUser.value = res.user;
        localStorage.setItem('quizcloud_user', JSON.stringify(res.user));
        if (res.user.role === 'teacher') {
            activeTab.value = 'manage';
        } else {
            studentName.value = res.user.name;
            activeTab.value = 'take';
            if (pendingQuizId.value > 0) {
                await startQuiz(pendingQuizId.value);
            }
        }
        await Promise.all([fetchQuizzes(), fetchAttempts()]);
    } catch (err: any) {
        loginError.value = err?.data?.error || 'Verifica tu nombre y correo.';
    } finally {
        isLoggingIn.value = false;
    }
};

const logout = () => {
    currentUser.value = null;
    localStorage.removeItem('quizcloud_user');
    activeQuiz.value = null;
    attemptResult.value = null;
    individualResult.value = null;
};

const copyQuizLink = async (id: number) => {
    const url = `${window.location.origin}/?quiz=${id}`;
    await navigator.clipboard.writeText(url);
    copiedQuizId.value = id;
    setTimeout(() => {
        copiedQuizId.value = null;
    }, 2000);
};

const saveQuiz = async () => {
    if (isSaving.value) return;
    feedback.value = '';
    isError.value = false;
    isSaving.value = true;
    try {
        await $fetch(`${apiBase}/api/quizzes`, {
            method: 'POST',
            body: { ...newQuiz, teacher_id: currentUser.value?.id }
        });
        feedback.value = '¡Cuestionario guardado exitosamente en PostgreSQL!';
        newQuiz.title = '';
        newQuiz.description = '';
        newQuiz.questions = [createBlankQuestion()];
        await fetchQuizzes();
    } catch (err: any) {
        isError.value = true;
        feedback.value = err?.data?.error || 'Error al guardar: llena todos los campos.';
    } finally {
        isSaving.value = false;
    }
};

const deleteQuiz = async (id: number, title: string) => {
    if (!window.confirm(`¿Eliminar "${title}"?`)) return;
    try {
        await $fetch(`${apiBase}/api/quizzes/${id}`, { method: 'DELETE' });
        await fetchQuizzes();
        await fetchAttempts();
    } catch (err) {
        console.error('Error al eliminar:', err);
    }
};

const startQuiz = async (id: number) => {
    takeError.value = '';
    attemptResult.value = null;
    for (const key of Object.keys(selectedAnswers)) {
        delete selectedAnswers[Number(key)];
    }
    try {
        activeQuiz.value = await $fetch(`${apiBase}/api/quizzes/${id}`);
        activeTab.value = 'take';
    } catch (err: any) {
        takeError.value = err?.data?.error || 'No se pudo cargar el cuestionario.';
    }
};

const resetAttempt = () => {
    attemptResult.value = null;
    takeError.value = '';
    for (const key of Object.keys(selectedAnswers)) {
        delete selectedAnswers[Number(key)];
    }
};

const submitAttempt = async () => {
    if (!activeQuiz.value || isSubmitting.value) return;
    takeError.value = '';
    isSubmitting.value = true;
    try {
        const answers = activeQuiz.value.questions.map((q: any) => ({
            question_id: q.id,
            selected_option_id: selectedAnswers[q.id]
        }));
        attemptResult.value = await $fetch(`${apiBase}/api/attempts`, {
            method: 'POST',
            body: {
                quiz_id: activeQuiz.value.id,
                student_id: currentUser.value?.id,
                student_name: studentName.value,
                answers
            }
        });
        await fetchAttempts();
    } catch (err: any) {
        takeError.value = err?.data?.error || 'Completa tu nombre y todas las preguntas.';
    } finally {
        isSubmitting.value = false;
    }
};

const openHistoryTab = async () => {
    activeTab.value = 'history';
    await fetchAttempts();
};

const viewIndividualResult = async (attemptId: number) => {
    try {
        individualResult.value = await $fetch(`${apiBase}/api/results/${attemptId}`);
    } catch (e) {
        console.error('Error cargando resultado individual:', e);
    }
};

onMounted(async () => {
    const params = new URLSearchParams(window.location.search);
    const qId = Number(params.get('quiz') || 0);
    if (qId > 0) {
        pendingQuizId.value = qId;
        loginForm.role = 'student';
    }

    const saved = localStorage.getItem('quizcloud_user');
    if (saved) {
        try {
            currentUser.value = JSON.parse(saved);
            if (currentUser.value?.role === 'teacher') {
                activeTab.value = 'manage';
            } else if (currentUser.value) {
                studentName.value = currentUser.value.name;
                activeTab.value = 'take';
            }
        } catch {
            localStorage.removeItem('quizcloud_user');
        }
    }

    await Promise.all([fetchQuizzes(), fetchAttempts()]);
    if (currentUser.value?.role === 'student' && pendingQuizId.value > 0) {
        await startQuiz(pendingQuizId.value);
    }
});
</script>
