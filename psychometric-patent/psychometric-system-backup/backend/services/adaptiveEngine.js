/**
 * Adaptive Assessment & Question Selection Engine
 * 
 * Manages competency blueprints, question graph selection, difficulty adjustments,
 * and secure server-side answer verification.
 */

const Question = require("../models/Question");

// Complete built-in question repository (used directly or seeded into MongoDB)
const QUESTION_BANK = [
    // Difficulty 1 (Foundation)
    {
        questionId: "ds-01",
        domain: "Data Structures",
        difficulty: 1,
        type: "mcq",
        bloom: "Remember",
        competency: "Knowledge",
        question: "Which data structure operates on a Last-In, First-Out (LIFO) order?",
        options: ["Queue", "Stack", "Binary Tree", "Adjacency Matrix"],
        answer: 1,
        concepts: ["stack", "lifo", "memory"],
        explanation: "A Stack removes the most recently added element first, following the LIFO principle."
    },
    {
        questionId: "algo-01",
        domain: "Algorithms",
        difficulty: 1,
        type: "mcq",
        bloom: "Understand",
        competency: "Reasoning",
        question: "What is the worst-case time complexity of binary search on a sorted array of size n?",
        options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"],
        answer: 1,
        concepts: ["binary search", "asymptotics", "logarithmic"],
        explanation: "Binary search cuts the search space in half at each step, yielding O(log n) time complexity."
    },
    {
        questionId: "db-01",
        domain: "DBMS",
        difficulty: 1,
        type: "mcq",
        bloom: "Remember",
        competency: "Knowledge",
        question: "Which SQL clause is used to filter records based on a specified condition?",
        options: ["ORDER BY", "GROUP BY", "WHERE", "JOIN"],
        answer: 2,
        concepts: ["sql", "filtering", "where clause"],
        explanation: "The WHERE clause is applied to filter rows before aggregation or sorting."
    },
    {
        questionId: "os-01",
        domain: "Operating Systems",
        difficulty: 1,
        type: "mcq",
        bloom: "Understand",
        competency: "Knowledge",
        question: "What is the primary function of the Operating System Kernel?",
        options: ["Compile user application code", "Bridge between hardware components and user processes", "Host the remote database server", "Format peripheral storage drives"],
        answer: 1,
        concepts: ["kernel", "hardware abstraction", "process management"],
        explanation: "The kernel manages CPU, memory, and devices, serving as the core bridge to hardware."
    },
    {
        questionId: "net-01",
        domain: "Computer Networks",
        difficulty: 1,
        type: "mcq",
        bloom: "Remember",
        competency: "Knowledge",
        question: "At which layer of the OSI model does the Internet Protocol (IP) operate?",
        options: ["Data Link Layer", "Transport Layer", "Network Layer", "Session Layer"],
        answer: 2,
        concepts: ["osi model", "ip", "network layer"],
        explanation: "IP is responsible for packet routing across networks at Layer 3 (Network Layer)."
    },

    // Difficulty 2 (Intermediate)
    {
        questionId: "ds-02",
        domain: "Data Structures",
        difficulty: 2,
        type: "mcq",
        bloom: "Apply",
        competency: "Problem Solving",
        question: "Which data structure is fundamentally required to implement Breadth-First Search (BFS) on a graph?",
        options: ["Stack", "Queue", "Priority Queue", "Min-Heap"],
        answer: 1,
        concepts: ["bfs", "queue", "graph traversal"],
        explanation: "BFS explores vertices level by level, requiring FIFO ordering provided by a Queue."
    },
    {
        questionId: "algo-02",
        domain: "Algorithms",
        difficulty: 2,
        type: "mcq",
        bloom: "Analyze",
        competency: "Analytical Thinking",
        question: "Which algorithmic paradigm does Merge Sort primarily demonstrate?",
        options: ["Greedy Choice", "Divide and Conquer", "Backtracking", "Dynamic Programming"],
        answer: 1,
        concepts: ["merge sort", "divide and conquer", "recursion"],
        explanation: "Merge sort divides the array into halves, recursively sorts them, and merges the sorted halves."
    },
    {
        questionId: "db-02",
        domain: "DBMS",
        difficulty: 2,
        type: "mcq",
        bloom: "Apply",
        competency: "Reasoning",
        question: "What ACID property ensures that all operations in a transaction either complete entirely or fail entirely?",
        options: ["Consistency", "Isolation", "Atomicity", "Durability"],
        answer: 2,
        concepts: ["acid", "atomicity", "transactions"],
        explanation: "Atomicity guarantees all-or-nothing execution of database transactions."
    },
    {
        questionId: "os-02",
        domain: "Operating Systems",
        difficulty: 2,
        type: "mcq",
        bloom: "Analyze",
        competency: "Problem Solving",
        question: "Which CPU scheduling algorithm is most susceptible to process starvation when high-priority tasks arrive continuously?",
        options: ["Round Robin", "First-Come First-Served (FCFS)", "Preemptive Priority Scheduling", "Shortest Remaining Time First with Aging"],
        answer: 2,
        concepts: ["scheduling", "starvation", "priority inversion"],
        explanation: "Pure priority scheduling without aging leaves low-priority processes waiting indefinitely."
    },
    {
        questionId: "net-02",
        domain: "Computer Networks",
        difficulty: 2,
        type: "mcq",
        bloom: "Understand",
        competency: "Reasoning",
        question: "What is the key mechanism TCP uses to establish a reliable connection before transmitting data?",
        options: ["UDP datagram broadcast", "Three-Way Handshake (SYN, SYN-ACK, ACK)", "DNS round-robin lookup", "Sliding window reset"],
        answer: 1,
        concepts: ["tcp", "three-way handshake", "reliability"],
        explanation: "TCP establishes a full-duplex session through the SYN, SYN-ACK, ACK sequence."
    },

    // Difficulty 3 (Advanced)
    {
        questionId: "ds-03",
        domain: "Data Structures",
        difficulty: 3,
        type: "mcq",
        bloom: "Evaluate",
        competency: "Analytical Thinking",
        question: "In a self-balancing AVL tree, what is the maximum permissible difference in height between left and right subtrees?",
        options: ["0", "1", "2", "log(n)"],
        answer: 1,
        concepts: ["avl tree", "balance factor", "tree rotations"],
        explanation: "An AVL tree requires that the balance factor (height difference) of any node is at most 1 (-1, 0, or 1)."
    },
    {
        questionId: "algo-03",
        domain: "Algorithms",
        difficulty: 3,
        type: "mcq",
        bloom: "Analyze",
        competency: "Problem Solving",
        question: "What is the optimal time complexity to compute the shortest path between all pairs of vertices in a dense weighted graph without negative cycles?",
        options: ["O(V + E)", "O(V²)", "O(V³)", "O(E log V)"],
        answer: 2,
        concepts: ["floyd warshall", "all-pairs shortest path", "graph algorithms"],
        explanation: "The Floyd-Warshall dynamic programming algorithm solves all-pairs shortest paths in O(V³) time."
    },
    {
        questionId: "db-03",
        domain: "DBMS",
        difficulty: 3,
        type: "mcq",
        bloom: "Evaluate",
        competency: "Knowledge",
        question: "Which database normal form strictly eliminates transitive functional dependencies on non-prime attributes?",
        options: ["First Normal Form (1NF)", "Second Normal Form (2NF)", "Third Normal Form (3NF)", "Boyce-Codd Normal Form (BCNF) only"],
        answer: 2,
        concepts: ["normalization", "3nf", "transitive dependency"],
        explanation: "3NF requires 2NF plus the absence of transitive dependencies for non-prime attributes."
    },
    {
        questionId: "os-03",
        domain: "Operating Systems",
        difficulty: 3,
        type: "mcq",
        bloom: "Evaluate",
        competency: "Reasoning",
        question: "Which condition is NOT strictly required for a system deadlock to occur according to Coffman's conditions?",
        options: ["Mutual Exclusion", "Hold and Wait", "Preemption of Allocated Resources", "Circular Wait"],
        answer: 2,
        concepts: ["deadlock", "coffman conditions", "no preemption"],
        explanation: "Deadlock requires NO PREEMPTION. Allowing resource preemption prevents deadlock."
    },
    {
        questionId: "code-03",
        domain: "Software Engineering",
        difficulty: 3,
        type: "mcq",
        bloom: "Apply",
        competency: "Coding & Design",
        question: "Which software design pattern delegates object creation to derived subclasses while maintaining a consistent interface?",
        options: ["Singleton", "Factory Method", "Observer", "Adapter"],
        answer: 1,
        concepts: ["design patterns", "factory method", "polymorphism"],
        explanation: "The Factory Method pattern defines an interface for creating an object, but lets subclasses decide which class to instantiate."
    },

    // Voice Interview Questions
    {
        questionId: "voice-01",
        domain: "Behavioral & Technical Communication",
        difficulty: 2,
        type: "voice",
        bloom: "Evaluate",
        competency: "Communication & Problem Solving",
        question: "Describe a challenging technical bug you encountered in a project, how you diagnosed it, and what you learned from the resolution.",
        keywords: ["bug", "debug", "approach", "root cause", "solution", "tested", "learned"],
        options: []
    },
    {
        questionId: "voice-02",
        domain: "Behavioral & Adaptability",
        difficulty: 2,
        type: "voice",
        bloom: "Evaluate",
        competency: "Adaptability & Resilience",
        question: "How do you respond when your initial technical design fails or requirements change unexpectedly right before a project deadline?",
        keywords: ["analyze", "prioritize", "feedback", "alternative", "communicate", "adapt", "deliver"],
        options: []
    },
    {
        questionId: "voice-03",
        domain: "Technical Explanation",
        difficulty: 3,
        type: "voice",
        bloom: "Understand",
        competency: "Technical Communication",
        question: "Explain the concept of database indexing to a junior student, including when to use an index and what trade-offs exist.",
        keywords: ["b-tree", "lookup", "speed", "search", "write", "overhead", "storage", "performance"],
        options: []
    }
];

/**
 * Calculates next difficulty tier based on answer correctness, speed, and confidence
 */
const calculateNextDifficulty = (currentDifficulty, isCorrect, responseMs, confidence = 65) => {
    // Correct and fast with good confidence -> step up
    if (isCorrect && responseMs < 20000 && confidence >= 60) {
        return Math.min(3, currentDifficulty + 1);
    }
    // Incorrect and struggling/slow -> step down
    if (!isCorrect && responseMs > 25000) {
        return Math.max(1, currentDifficulty - 1);
    }
    return currentDifficulty;
};

/**
 * Dynamically picks the next question from the bank matching target difficulty
 */
const selectNextQuestion = ({
    targetDifficulty = 2,
    attemptedQuestionIds = [],
    preferredDomain = null
}) => {
    const mcqs = QUESTION_BANK.filter((q) => q.type === "mcq");
    const unattempted = mcqs.filter((q) => !attemptedQuestionIds.includes(q.questionId));

    if (unattempted.length === 0) {
        return null;
    }

    // First try exact difficulty match
    let candidates = unattempted.filter((q) => q.difficulty === targetDifficulty);

    // If no exact match, sort by distance to target difficulty
    if (candidates.length === 0) {
        candidates = [...unattempted].sort((a, b) => {
            return Math.abs(a.difficulty - targetDifficulty) - Math.abs(b.difficulty - targetDifficulty);
        });
    }

    // If preferredDomain is specified and available, prioritize it
    if (preferredDomain) {
        const domainMatch = candidates.filter((q) => q.domain === preferredDomain);
        if (domainMatch.length > 0) {
            candidates = domainMatch;
        }
    }

    // Pick first candidate
    const chosen = candidates[0];

    // Strip out the answer before returning to client!
    return {
        questionId: chosen.questionId,
        domain: chosen.domain,
        difficulty: chosen.difficulty,
        bloom: chosen.bloom,
        competency: chosen.competency,
        question: chosen.question,
        options: chosen.options,
        concepts: chosen.concepts,
        totalAvailable: mcqs.length
    };
};

/**
 * Validates candidate's MCQ answer securely on the server
 */
const verifyAnswer = (questionId, choiceIndex) => {
    const question = QUESTION_BANK.find((q) => q.questionId === questionId);
    if (!question) {
        return { valid: false, error: "Question not found" };
    }

    const isCorrect = Number(choiceIndex) === question.answer;

    return {
        valid: true,
        isCorrect,
        correctAnswerIndex: question.answer,
        explanation: question.explanation,
        concepts: question.concepts,
        difficulty: question.difficulty,
        competency: question.competency
    };
};

/**
 * Retrieves voice interview questions
 */
const getVoiceQuestions = () => {
    return QUESTION_BANK.filter((q) => q.type === "voice").map((q) => ({
        questionId: q.questionId,
        domain: q.domain,
        difficulty: q.difficulty,
        bloom: q.bloom,
        competency: q.competency,
        question: q.question,
        keywords: q.keywords
    }));
};

module.exports = {
    QUESTION_BANK,
    calculateNextDifficulty,
    selectNextQuestion,
    verifyAnswer,
    getVoiceQuestions
};
