# 🪞 MYRA – AI Wardrobe & Style Assistant  

An intelligent React Native app that helps users manage wardrobes, plan outfits, and get AI + weather-based clothing recommendations.  

## 🚀 Features  

### 🏠 Dashboard  
- Real-time **weather integration** (auto location detection)  
- **Outfit suggestions** based on temperature & event context  
- **Calendar widget** synced with user events  

### 👕 Wardrobe  
- Add clothes via **photo scanner**  
- Smart **categorization** (top, bottom, dress, shoes, accessories)  
- **Color detection** + tagging  
- AI-based **outfit generation** using backend agent  

### 📅 Calendar  
- Add/edit/delete events  
- Suggests **outfits per event type** (formal, casual, interview, etc.)  

### 🔔 Notifications  
- Smart alerts for **weather, outfits, and events**  
- Supports **local push notifications**  

### 🧠 AI Features  
- Integrated **RAG pipeline** for personalized outfit reasoning  
- Backend **AI Agent** connected with weather + calendar APIs  
- Uses **LLM + vector DB** for contextual recommendations  

---


## 🧰 Tech Stack  

| Layer | Tools |
|-------|-------|
| **Frontend** | React Native, Expo, TypeScript |
| **Backend** | Python (FastAPI/Flask), LangGraph/LangChain |
| **Database** | MongoDB / AWS DynamoDB |
| **AI & NLP** | Microsoft Phi-3, GPT-4, OpenAI API |
| **State Mgmt** | Zustand |
| **APIs** | OpenWeatherMap, Google Calendar |
| **Dev Tools** | ESLint, Prettier, Expo CLI |

---

### Installation

1. **Clone the repository**
   ```bash
   git clone [<repository-url>](https://github.com/cherry0722/Style-with-Ai.git)
   cd ai-wardrobe
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   EXPO_PUBLIC_WEATHER_API_KEY=your_openweathermap_api_key
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Run on device/simulator**
   ```bash
   # iOS
   npm run ios
   
   # Android
   npm run android
   
   # Web
   npm run web
   ```

## Project Structure

```
myra/
├── src/
│   ├── screens/         # App screens
│   ├── components/      # Reusable UI components
│   ├── services/        # Weather, AI, Notifications
│   ├── store/           # Zustand stores
│   ├── navigation/      # App navigation
│   ├── utils/           # Helper functions
│   └── theme/           # Styling system
├── backend/
│   ├── main.py          # FastAPI entry point
│   ├── rag_engine.py    # RAG pipeline logic
│   ├── agent.py         # AI Agent core
│   └── db/              # MongoDB integration

```

## Architecture

### State Management
- **Zustand**: Lightweight, unopinionated state management
- **Persistent Storage**: Settings and user data persist across sessions
- **Modular Stores**: Separate stores for different features (closet, calendar, notifications, settings)

### Navigation
- **Stack Navigator**: Root navigation with auth flow
- **Bottom Tabs**: Main app navigation with Home as default
- **Type Safety**: Full TypeScript support for navigation

### Services
- **Weather Service**: OpenWeatherMap API integration with caching
- **Location Service**: GPS and geocoding with permission handling
- **Notification Service**: Local notifications for reminders and alerts

## Configuration

### Weather API
1. Sign up for a free API key at [OpenWeatherMap](https://openweathermap.org/api)
2. Add your API key to the `.env` file as `EXPO_PUBLIC_WEATHER_API_KEY`

### Permissions
The app requests the following permissions:
- **Location**: For weather data and location-based features
- **Camera**: For scanning clothing items
- **Notifications**: For outfit reminders and weather alerts

## Development

### Code Style
- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting (if configured)

### Testing
```bash
# Run tests
npm test

# Run tests in watch mode
npm test -- --watch
```

### Building for Production

#### iOS
```bash
expo build:ios
```

#### Android
```bash
expo build:android
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@myra-app.com or join our Discord community.

---

Built with ❤️ by the Myra team
