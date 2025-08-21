# MindGains AI 🧠🚀

## The #1 AI-Powered Educational App for Indians

Transform Indians into intellectual powerhouses through daily AI-generated quizzes covering UPSC, SSC, Banking, and competitive exam topics.

### ✨ Core Features

- 🎯 **Daily AI Quizzes**: Fresh questions every day using OpenAI/Claude
- 📚 **Subject-Specific Learning**: History, Polity, Geography, Economy, Science & Current Affairs  
- 🏆 **Gamification**: Streaks, achievements, leaderboards
- 🤖 **AI Mascot**: Personalized learning recommendations
- 📊 **Progress Tracking**: Detailed analytics and weak area identification
- ⚔️ **Battle System**: Real-time quiz battles with friends
- 🇮🇳 **India Challenge**: Daily nationwide tournaments
- 💰 **Freemium Model**: 3 free quizzes daily, unlimited with premium

---

## 🚀 Quick Start

### 1. Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### 2. Environment Setup

Your `.env` file contains:
```env
EXPO_PUBLIC_SUPABASE_URL=https://iyguhaxhomtcjafvfupu.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENAI_API_KEY=sk-proj-13kFT-ijZswTP2Dr-rhJsey2a1ArgzO3...
CLAUDE_API_KEY=sk-ant-api03-ck5Myqq6WqWzaptFkiFM32CLKwq4hRWq...
GROK_API_KEY=xai-G4uiPdQlSZp9VLsjMCLxJxuqxcLS4nQuTNHE...
```

### 3. Core Edge Functions ✅

**Essential Functions (Keep These):**
- `daily-quiz-generator` - Generates daily AI quizzes
- `topic-quiz-generator` - Generates topic-specific quizzes  
- `create-mission` - Creates learning missions
- `get-mission-content` - Retrieves mission content
- `update-progress` - Updates user progress
- `submit-daily-quiz` - Handles quiz submissions
- `validate-daily-quiz` - Validates quiz quality
- `generate-subject-quiz` - Subject-based quizzes
- `generate-topic-questions` - Topic question generation
- `get-mascot-recommendations` - AI recommendations
- `regenerate-topic-questions` - Admin question refresh
- `create-user-profile` - User onboarding
- `update-quiz-progress` - Quiz progress tracking
- `analyze-content` - Content analysis
- `ai-battle-content` - Battle system content
- `battle-operations` - Battle management
- `india-challenge` - Daily India Challenge

### 4. Run the App

```bash
# Start Expo development server
npm run dev

# Press 'a' for Android emulator
# Or scan QR code with Expo Go app
```

---

## 📱 App Architecture

### Core Screens
- **Home** (`app/(tabs)/index.tsx`) - Dashboard with progress
- **Learn** (`app/(tabs)/learn.tsx`) - Content creation and subjects
- **Battle** (`app/(tabs)/battle.tsx`) - Quiz battles with friends
- **India Challenge** (`app/(tabs)/india-challenge.tsx`) - National tournaments
- **Leaderboard** (`app/(tabs)/leaderboard.tsx`) - Rankings and competition
- **Profile** (`app/(tabs)/profile.tsx`) - User stats and settings

### Learning System
- **Mission Creation** (`app/mission/create.tsx`) - Create learning content
- **4-Room System**: Clarity → Quiz → Memory → Test
- **Content Viewer** (`app/learn/content-viewer.tsx`) - Structured learning

### Quiz System
- **Daily Quiz** (`app/quiz/daily.tsx`) - AI-generated daily challenges
- **Topic Quiz** (`app/quiz/topic.tsx`) - Subject-specific practice
- **Results** (`app/quiz/daily-results.tsx`) - Detailed performance analysis

---

## 🗃️ Database Schema

### Core Tables
- **daily_quizzes**: AI-generated daily quiz content
- **user_stats**: Progress tracking and gamification
- **missions**: User-created learning content
- **battle_rooms**: Real-time quiz battles
- **indian_subjects**: Exam subjects and topics
- **profiles**: User profiles and authentication

---

## 🎯 Making It #1 Educational App

### 1. **Content Strategy**
- Daily fresh AI-generated content
- Exam-focused questions (UPSC, SSC, Banking)
- Current affairs updated weekly
- Progressive difficulty adaptation

### 2. **User Engagement**
- Daily streaks and rewards
- Regional leaderboards  
- Battle system for competition
- Push notifications at optimal times

### 3. **Monetization**
```
Free Tier: 3 quizzes/day
Premium: ₹299/month - Unlimited access
Annual: ₹2999/year - All features + priority support
```

### 4. **Technical Excellence**
- AI-powered content generation
- Real-time multiplayer battles
- Advanced analytics and progress tracking
- Responsive design for all devices

---

## 🛠️ Development Commands

```bash
# Development
npm run dev                 # Start dev server

# Edge Functions (if needed)
npx supabase functions deploy daily-quiz-generator
npx supabase functions deploy topic-quiz-generator
npx supabase functions deploy create-mission

# Database
npx supabase db pull        # Sync remote schema
npx supabase db push        # Push local changes
```

---

## 📈 Success Metrics

Track these KPIs:
1. **DAU/MAU**: Daily/Monthly Active Users
2. **Retention**: D1, D7, D30 retention rates
3. **Engagement**: Questions attempted per session
4. **Conversion**: Free to paid conversion rate
5. **LTV**: Lifetime value per user

---

## 🎉 Next Steps

### Phase 1: Launch (Current)
- ✅ Core quiz functionality  
- ✅ AI integration
- ✅ User authentication
- ✅ Progress tracking
- ✅ Battle system
- ✅ India Challenge

### Phase 2: Growth  
- 🚀 Social features expansion
- 🚀 Video explanations
- 🚀 Mock tests and exam simulation
- 🚀 Regional language support

### Phase 3: Scale
- 🚀 Live coaching integration
- 🚀 Corporate partnerships  
- 🚀 B2B solutions for coaching institutes
- 🚀 International expansion

---

**Made with ❤️ for Indian Students**

Transform your knowledge, ace your exams, achieve your dreams! 🚀