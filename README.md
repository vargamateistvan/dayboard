# Dayboard

A customizable dashboard application built with React and TypeScript, featuring widgets for clock, weather, calendar, tasks, and timers with multiple themes and focus modes.

## Features

- **⏰ Clock Widget** - Display current time with customizable formats
- **🌍 Timezone Clock Widget** - Compare local time with another city
- **🌤️ Weather Widget** - Real-time weather information
- **📅 Calendar Widget** - Interactive calendar with event support (iCal.js integration)
- **📝 Task Widget** - Manage and track your tasks
- **💬 Quote of the Day Widget** - Daily inspiration with optional rotation
- **⏱️ Timer Panel** - Set and manage timers
- **🎨 Multiple Themes** - Choose from various visual themes:
  - Default
  - Retro
  - Futuristic
  - Nature
  - Ocean
  - Sunset
- **🎯 Focus Mode** - Minimize distractions with a clean focus interface
- **⚙️ Customizable Settings** - Personalize the dashboard to your preferences
- **🔔 Event Notifications** - Get notified about upcoming events
- **📱 Responsive Design** - Works on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js 18+ 
- Yarn or npm

### Installation

```bash
# Install dependencies
yarn install
# or
npm install
```

### Development

```bash
# Start the development server
yarn dev
# or
npm run dev
```

The application will be available at `http://localhost:5175/dayboard/`

### Building

```bash
# Build for production
yarn build
# or
npm run build
```

The build output will be in the `dist` directory.

### Testing

```bash
# Run tests once
yarn test
# or
npm test

# Run tests in watch mode
yarn test:watch
# or
npm run test:watch
```

## Project Structure

```
src/
├── components/       # React components (Clock, Weather, Calendar, etc.)
├── lib/             # Utilities and hooks (useSettings, useTheme, etc.)
├── themes/          # CSS theme files
├── test/            # Test files
├── App.tsx          # Main app component
├── main.tsx         # Entry point
└── vite-env.d.ts    # Vite type definitions
```

## Tech Stack

- **React** 18.3.1 - UI framework
- **TypeScript** ~5.6.2 - Type safety
- **Vite** 6.3.5 - Build tool and dev server
- **ical.js** 2.1.0 - Calendar/iCal support
- **Lucide React** 0.511.0 - Icon library
- **Vitest** 3.2.4 - Testing framework
- **@testing-library/react** - React testing utilities

## Scripts

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn preview` - Preview production build
- `yarn test` - Run tests once
- `yarn test:watch` - Run tests in watch mode

## License

MIT

## Contributing

Feel free to fork this project and submit pull requests for any improvements.
