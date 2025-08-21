# MindGains AI - Setup Guide

## 🚀 Quick Setup

### 1. Prerequisites
- Node.js 18+ and npm
- Expo CLI (`npm install -g expo`)
- Android Studio or Expo Go app

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Your `.env` file is already configured with:
- ✅ Supabase URL and Anon Key
- ✅ OpenAI API Key
- ✅ Claude API Key
- ✅ Grok API Key

### 4. Run the App

```bash
# Start Expo development server
npm run dev

# Press 'a' to open on Android emulator
# Or scan QR code with Expo Go app
```

## 📱 Core Features

### Working Features:
1. **Daily Quiz**: AI-generated daily quizzes with 20 questions
2. **Topic Quizzes**: Subject-specific quizzes with 15+ questions
3. **Mission Creation**: Transform text into learning content
4. **User Progress**: Track performance and learning patterns
5. **Battle System**: Real-time quiz battles with friends
6. **India Challenge**: Daily nationwide tournaments
7. **Leaderboards**: Regional and national rankings
8. **Achievements**: Comprehensive gamification system

### Quiz Generation Flow:
1. User opens app → Checks for today's quiz
2. If no quiz exists → Edge function generates using AI
3. Questions saved to database → Displayed to user
4. User submits → Progress tracked and analyzed

## 🔧 Troubleshooting

### Issue: Quizzes Not Generating
**Solution**: 
1. Check Supabase logs: `npx supabase functions logs daily-quiz-generator`
2. Verify API keys are set in Supabase Dashboard
3. Check if database has proper permissions

### Issue: App Shows Demo Data
**Solution**: This is expected when Supabase is not reachable. The app has built-in demo mode.

## 🎯 Core Architecture

### Essential Files:
- `app/(tabs)/` - Main navigation screens
- `app/quiz/` - Quiz system
- `app/mission/` - Learning missions
- `app/battle/` - Battle system
- `components/ui/` - Reusable UI components
- `utils/supabaseService.ts` - Database service
- `constants/theme.ts` - Design system

### Edge Functions:
- Core learning functions (daily quiz, missions)
- Battle system functions
- Progress tracking functions
- User management functions

---

**Ready to launch and conquer the Indian educational market! 🇮🇳🚀**