AI PSYCHOMETRIC PATENT EDITION V2

RUN BACKEND
cd backend
npm install
npm run dev

RUN FRONTEND
cd frontend
npm install
npm start

DEMO FLOW
Register/Login -> Identity -> Device Validation -> Behavioral Baseline -> Adaptive Setup -> MCQ + Live Monitoring -> Voice Interview -> Cognitive Report

NOTES
- MongoDB is optional for the demo. The backend continues in fallback mode.
- Camera and microphone permissions are required.
- Use Chrome or Edge on localhost.
- The browser SpeechRecognition API may not be available everywhere; a typed transcript fallback is included.
- This is a functional patent-oriented prototype, not a clinically validated psychometric instrument.
