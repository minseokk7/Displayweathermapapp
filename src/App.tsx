import { WeatherMap } from './components/WeatherMap';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <div className="size-full bg-gradient-to-br from-blue-50 to-indigo-50">
      <WeatherMap />
      <Toaster />
    </div>
  );
}