// Instructor-owned demo content stored in MongoDB, never a frontend fallback.
const courses = [
  ['React Components and Hooks', 'Development', 'Intermediate', 'Build a searchable task board', ['Component composition', 'State and effects', 'Custom hooks'], 'photo-1633356122544-f134324a6cee'],
  ['Python for Everyday Automation', 'Development', 'Beginner', 'Build a file organization script', ['Variables and collections', 'Files and functions', 'Error handling'], 'photo-1515879218367-8466d910aaa4'],
  ['Node.js API Development', 'Development', 'Intermediate', 'Build a small library API', ['HTTP and routing', 'Request validation', 'Database integration'], 'photo-1555066931-4365d14bab8c'],
  ['UI Design with Figma', 'Design', 'Beginner', 'Design a mobile booking screen', ['Frames and layout', 'Reusable components', 'Interactive prototypes'], 'photo-1561070791-2526d30994b5'],
  ['UX Research and Usability', 'Design', 'Beginner', 'Create a usability study plan', ['Research questions', 'Interview planning', 'Finding themes'], 'photo-1581291518857-4e27b48ff24e'],
  ['Brand Identity Essentials', 'Design', 'Beginner', 'Create a mini brand style guide', ['Brand personality', 'Typography and color', 'Consistent applications'], 'photo-1626785774573-4b799315345d'],
  ['Content Marketing Workshop', 'Marketing', 'Beginner', 'Build a four-week content calendar', ['Audience needs', 'Content pillars', 'Editorial planning'], 'photo-1552664730-d307ca884978'],
  ['SEO Foundations', 'Marketing', 'Beginner', 'Prepare an on-page optimization checklist', ['Search intent', 'Page structure', 'Measurement basics'], 'photo-1460925895917-afdab827c52f'],
  ['Project Management Fundamentals', 'Business', 'Beginner', 'Plan a small product launch', ['Scope and milestones', 'Task ownership', 'Risk and communication'], 'photo-1454165804606-c3d57bc86b40'],
  ['Presentations That Tell a Story', 'Business', 'Beginner', 'Create a five-slide project pitch', ['Audience and purpose', 'Narrative structure', 'Clear visual evidence'], 'photo-1475721027785-f74eccf877e2'],
  ['Photography in Natural Light', 'Photography', 'Beginner', 'Create a three-photo visual story', ['Exposure basics', 'Light and composition', 'Selecting and editing'], 'photo-1452587925148-ce544e77e70d'],
  ['Smartphone Video Storytelling', 'Photography', 'Beginner', 'Shoot a 30-second introduction video', ['Shot planning', 'Stable footage and audio', 'Editing a sequence'], 'photo-1492691527719-9d1e07e534b4'],
  ['Guitar Chords for Beginners', 'Music', 'Beginner', 'Play a simple chord progression', ['Tuning and posture', 'Open chords', 'Rhythm and transitions'], 'photo-1510915361894-db8b60106cb1'],
  ['Music Production Basics', 'Music', 'Beginner', 'Arrange a short instrumental loop', ['Session setup', 'Rhythm and melody', 'Basic mixing'], 'photo-1598488035139-bdbb2231ce04'],
  ['Conversational French: First Steps', 'Languages', 'Beginner', 'Practice a short introduction conversation', ['Greetings and pronunciation', 'Everyday questions', 'Listening and responses'], 'photo-1502602898657-3e91760cbb34'],
  ['Data Analysis with Spreadsheets', 'Data Science', 'Beginner', 'Build a small sales summary dashboard', ['Cleaning tabular data', 'Formulas and summaries', 'Charts and interpretation'], 'photo-1551288049-bebda4e38f71'],
];

module.exports = courses.map(([title, category, level, project, topics, photo], index) => ({
  title, category, level, price: 0, currency: 'USD', language: 'English', duration: 180,
  totalSessions: 3, maxStudents: 24, status: 'published', isLive: true,
  thumbnail: `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1200&q=80`,
  description: `Explore ${title.toLowerCase()} through guided demonstrations, practical exercises, and a final project. ${project}. This is a demo course for exploring Nexnoon's student and teacher workflows.`,
  learningOutcomes: topics.map(topic => `Understand and practice ${topic.toLowerCase()}`).concat([project]),
  prerequisites: [level === 'Intermediate' ? 'Some experience with the subject is recommended' : 'No previous experience required', 'A computer with internet access', category === 'Music' ? 'An instrument or music software for practice' : 'A notebook or document for your exercises'],
  materials: [`Preparation: Review the course topics and write down two questions.`, `Project brief: ${project}.`, 'Review checklist: Explain your choices, check your work, and identify one improvement.'],
  details: {
    overview: `This three-session workshop introduces ${topics.join(', ').toLowerCase()}. Each session combines a focused demonstration with an exercise you can complete at your own pace.\n\nYour final project is to ${project.toLowerCase()}. You will develop it across the sessions, review it against a checklist, and explain your decisions.\n\nThis course is part of the Nexnoon demonstration catalogue. No live meeting is attached to the demo schedule.`,
    instructorTitle: `${category} Demo Instructor`,
    instructorBio: `Demo Teacher manages this ${category.toLowerCase()} workshop for the Nexnoon platform demonstration. Use the teacher account to explore editing course content, managing the curriculum, and viewing enrolled students.`,
    curriculumIntro: 'Three 60-minute sessions with a practical project developed throughout the course.',
    curriculum: topics.map((topic, i) => ({ title: `Session ${i + 1}: ${topic}`, topics: [`Core ideas in ${topic.toLowerCase()}`, 'Guided demonstration', 'Independent practice and discussion'], project: i === 0 ? `Plan your project: ${project}.` : i === 1 ? `Develop a first version: ${project}.` : `Review and present your finished project: ${project}.` })),
    outcomes: [`Explain the essentials of ${title.toLowerCase()}`, ...topics.map(t => `Apply ${t.toLowerCase()} to a practical task`), `Complete and explain your project: ${project}`],
    certificateInfo: 'This demonstration course does not issue certificates. The certificate design is shown as a preview only.',
    faqs: [
      { question: 'Who is this course for?', answer: `This ${level.toLowerCase()} workshop is for learners interested in ${category.toLowerCase()} who want a practical introduction to the topics listed above.` },
      { question: 'How is the course structured?', answer: 'There are three 60-minute sessions. Each includes a demonstration, practice, and project work.' },
      { question: 'What will I make?', answer: `${project}. The curriculum describes how the project develops over the three sessions.` },
      { question: 'Can I join a live meeting?', answer: 'This is demo content for testing the platform. Scheduled sessions do not have Zoom links or recordings.' },
    ],
  },
}));
