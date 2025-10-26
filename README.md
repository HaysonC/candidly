# Candidly

Anti-Cluely for candidates. Databricks for interviewers.

## The Team
We are a team of engineers and math students from Columbia, the University of Toronto, and Stanford.

## Inspiration
We were domscrolling on Instagram one day - and we came across this Cluely thing, they claim no one can detect them. Their founder's slogan is

> cheat on everything

We don't think this is fair; a lot of us worked hard to get jobs. Another problem we see is the lack of standards across interviewers and the additional workload on senior SWEs to review interviews.

So we made Candidly — Anti-Cluely for Candidates, Databricks for Interviewers.

## What it does
It does two things (and more):

1. Detects and shows suspicious gazing and typing patterns for candidates.
2. Provides a video interviewing tool with template support, code questions, and a shared editor for interviewers and candidates.
3. Records interviews, highlights notable candidates, and provides insights for HR on interviewer performance and directions.

## How we built it
- P2P interview video call with WebRTC
- Gaze tracking with WebGazer based on Brown University research [1]
- Gemini API on LangChain for RAG and agentic summary
- ChromaDB as a vector database for scalable RAG
- Deepgram for speech-to-text transcription
- Next.js frontend on Vercel for serverless API functions, secrets management, and hosting
- FastAPI backend for state management and interview data storage
- ...and, of course, about seven and a half cans of Red Bull

## Accomplishments we're proud of
We implemented a reliable app that achieves everything we proposed.

## What's next for Candidly
Train a more advanced gaze algorithm to detect complex anomaly signals, improve the frontend experience for HR and hiring managers, enhance connectivity, and expand web-based anti-cheat features.

^ as per the goal of this project, this is 0% AI-written :)

## References
[1] https://webgazer.cs.brown.edu/
