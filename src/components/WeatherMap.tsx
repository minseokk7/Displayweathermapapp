import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Cloud, CloudRain, Sun, Wind, Droplets, Eye, Gauge, MapPin, Search, Loader2, CloudSnow, CloudFog } from 'lucide-react';
import { toast } from 'sonner';

interface WeatherData {
  location: string;
  country: string;
  temp: number;
  feelsLike: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  visibility: number;
  pressure: number;
  uv: number;
  icon: string;
  sunrise?: string;
  sunset?: string;
}

interface ForecastDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  condition: string;
  icon: string;
}

interface LocationData {
  name: string;
  lat: number;
  lon: number;
  weather?: WeatherData;
  forecast?: ForecastDay[];
}

const getWeatherIcon = (condition: string) => {
  const lower = condition.toLowerCase();
  if (lower.includes('rain') || lower.includes('drizzle') || lower.includes('비') || lower.includes('소나기')) return CloudRain;
  if (lower.includes('snow') || lower.includes('눈')) return CloudSnow;
  if (lower.includes('fog') || lower.includes('mist') || lower.includes('안개')) return CloudFog;
  if (lower.includes('cloud') || lower.includes('overcast') || lower.includes('구름')) return Cloud;
  if (lower.includes('clear') || lower.includes('sunny') || lower.includes('맑음')) return Sun;
  return Cloud;
};

export function WeatherMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [selectedLocation, setSelectedLocation] = useState<LocationData>({
    name: '서울',
    lat: 37.5665,
    lon: 126.9780,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentLocations, setRecentLocations] = useState<LocationData[]>([]);

  // Load Leaflet CSS
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      attributionControl: false // Hide attribution
    }).setView([37.5665, 126.9780], 11);

    // Use CARTO Dark Matter (dark grayscale) tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Add click handler
    map.on('click', (e: L.LeafletMouseEvent) => {
      fetchWeather(e.latlng.lat, e.latlng.lng);
    });

    mapInstanceRef.current = map;

    // Fix map size after initialization
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update marker when location changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Remove old marker
    if (markerRef.current) {
      markerRef.current.remove();
    }

    // Create custom icon
    const customIcon = L.divIcon({
      html: `
        <div style="
          background: white;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          border: 3px solid #3b82f6;
        ">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            <circle cx="12" cy="12" r="4"/>
          </svg>
        </div>
      `,
      className: 'custom-weather-icon',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    // Add new marker
    const marker = L.marker([selectedLocation.lat, selectedLocation.lon], { icon: customIcon })
      .addTo(mapInstanceRef.current);

    if (selectedLocation.weather) {
      marker.bindPopup(`
        <div style="text-align: center;">
          <p style="font-weight: 600; margin-bottom: 4px;">${selectedLocation.name}</p>
          <p style="font-size: 1.5rem; margin: 4px 0;">${selectedLocation.weather.temp}°C</p>
          <p style="font-size: 0.875rem; color: #6b7280;">${selectedLocation.weather.condition}</p>
        </div>
      `);
    }

    markerRef.current = marker;

    // Pan to location
    mapInstanceRef.current.setView([selectedLocation.lat, selectedLocation.lon], 11, {
      animate: true,
    });
  }, [selectedLocation]);

  // Fetch weather data
  const fetchWeather = async (lat: number, lon: number) => {
    setLoading(true);
    try {
      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`
      );
      
      if (!weatherResponse.ok) {
        throw new Error('날씨 데이터를 가져올 수 없습니다');
      }

      const weatherData = await weatherResponse.json();
      
      const geoResponse = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
      );
      const geoData = await geoResponse.json();

      const weatherCodeToCondition = (code: number) => {
        if (code === 0) return '맑음';
        if (code <= 3) return '구름 조금';
        if (code <= 48) return '안개';
        if (code <= 67) return '비';
        if (code <= 77) return '눈';
        if (code <= 82) return '소나기';
        if (code <= 86) return '눈';
        return '뇌우';
      };

      // Extract detailed location info
      const addr = geoData.address || {};
      const locationParts = [];
      
      // Add specific location details (동/리 level)
      if (addr.neighbourhood) locationParts.push(addr.neighbourhood);
      if (addr.suburb) locationParts.push(addr.suburb);
      if (addr.village) locationParts.push(addr.village);
      if (addr.hamlet) locationParts.push(addr.hamlet);
      
      // Add district/city level
      if (addr.city_district) locationParts.push(addr.city_district);
      if (addr.district) locationParts.push(addr.district);
      if (addr.borough) locationParts.push(addr.borough);
      
      // Add city level
      if (addr.city) locationParts.push(addr.city);
      if (addr.town) locationParts.push(addr.town);
      if (addr.county) locationParts.push(addr.county);
      
      // Use most specific available location
      const locationName = locationParts.length > 0 
        ? locationParts.slice(0, 2).join(', ') 
        : '알 수 없는 위치';

      const weather: WeatherData = {
        location: locationName,
        country: addr.country || '',
        temp: Math.round(weatherData.current.temperature_2m),
        feelsLike: Math.round(weatherData.current.apparent_temperature),
        condition: weatherCodeToCondition(weatherData.current.weather_code),
        humidity: weatherData.current.relative_humidity_2m,
        windSpeed: Math.round(weatherData.current.wind_speed_10m),
        visibility: 10,
        pressure: Math.round(weatherData.current.surface_pressure),
        uv: 3,
        icon: '',
        sunrise: weatherData.daily.sunrise[0]?.split('T')[1],
        sunset: weatherData.daily.sunset[0]?.split('T')[1],
      };

      const forecast: ForecastDay[] = weatherData.daily.time.slice(0, 5).map((date: string, i: number) => ({
        date,
        maxTemp: Math.round(weatherData.daily.temperature_2m_max[i]),
        minTemp: Math.round(weatherData.daily.temperature_2m_min[i]),
        condition: weatherCodeToCondition(weatherData.daily.weather_code[i]),
        icon: '',
      }));

      const newLocation: LocationData = {
        name: weather.location,
        lat,
        lon,
        weather,
        forecast,
      };

      setSelectedLocation(newLocation);
      
      setRecentLocations(prev => {
        const filtered = prev.filter(loc => !(loc.lat === lat && loc.lon === lon));
        return [newLocation, ...filtered].slice(0, 5);
      });

      toast.success(`${weather.location}의 날씨 정보를 가져왔습니다`);
    } catch (error) {
      console.error('Weather fetch error:', error);
      toast.error('날씨 정보를 가져오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const searchCity = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`
      );
      const data = await response.json();
      
      if (data.length === 0) {
        toast.error('도시를 찾을 수 없습니다');
        return;
      }

      const { lat, lon } = data[0];
      await fetchWeather(parseFloat(lat), parseFloat(lon));
    } catch (error) {
      console.error('City search error:', error);
      toast.error('도시 검색에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('위치 서비스를 사용할 수 없습니다');
      return;
    }

    setLoading(true);
    toast.info('위치 정보를 가져오는 중...');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        fetchWeather(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        setLoading(false);
        
        if (error && error.code === 1) {
          toast.error('위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.');
        } else if (error && error.code === 2) {
          toast.error('위치 정보를 사용할 수 없습니다.');
        } else if (error && error.code === 3) {
          toast.error('위치 정��� 요청 시간이 초과되었습니다.');
        } else {
          toast.error('현재 위치를 가져올 수 없습니다. 지도를 클릭하거나 도시명을 검색해주세요.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  useEffect(() => {
    fetchWeather(selectedLocation.lat, selectedLocation.lon);
  }, []);

  const WeatherIcon = selectedLocation.weather 
    ? getWeatherIcon(selectedLocation.weather.condition)
    : Cloud;

  return (
    <div className="flex flex-col lg:flex-row h-full w-full gap-4 p-4">
      {/* Map Container */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Search Bar */}
        <Card className="p-4">
          <div className="flex gap-2">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="도시명 검색 (예: 서울, Tokyo, New York)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchCity()}
                disabled={loading}
              />
              <Button onClick={searchCity} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            <Button variant="outline" onClick={getCurrentLocation} disabled={loading}>
              <MapPin className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        {/* Map */}
        <div 
          ref={mapRef}
          className="flex-1 relative rounded-lg overflow-hidden bg-gray-100 h-[400px] lg:h-auto"
          style={{ minHeight: '400px' }}
        />

        {/* Recent Locations */}
        {recentLocations.length > 0 && (
          <Card className="p-4">
            <h3 className="mb-2 text-sm">최근 위치</h3>
            <div className="flex gap-2 flex-wrap">
              {recentLocations.map((loc, idx) => (
                <Button
                  key={`${loc.lat}-${loc.lon}-${idx}`}
                  variant="outline"
                  size="sm"
                  onClick={() => fetchWeather(loc.lat, loc.lon)}
                  disabled={loading}
                >
                  {loc.name}
                </Button>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Weather Info Panel */}
      <div className="w-full lg:w-96 space-y-4">
        {loading && !selectedLocation.weather ? (
          <Card className="p-6 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </Card>
        ) : selectedLocation.weather ? (
          <>
            {/* Main Weather Card */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl mb-1">{selectedLocation.weather.location}</h2>
                  <p className="text-sm text-gray-500">{selectedLocation.weather.country}</p>
                  <p className="text-gray-500">{selectedLocation.weather.condition}</p>
                </div>
                <WeatherIcon className="w-16 h-16 text-blue-500" />
              </div>

              <div className="text-5xl mb-2">
                {selectedLocation.weather.temp}°C
              </div>
              <div className="text-sm text-gray-500 mb-6">
                체감온도 {selectedLocation.weather.feelsLike}°C
              </div>

              {/* Weather Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Droplets className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-sm text-gray-500">습도</p>
                    <p>{selectedLocation.weather.humidity}%</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Wind className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">풍속</p>
                    <p>{selectedLocation.weather.windSpeed} km/h</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Eye className="w-5 h-5 text-indigo-400" />
                  <div>
                    <p className="text-sm text-gray-500">가시거리</p>
                    <p>{selectedLocation.weather.visibility} km</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Gauge className="w-5 h-5 text-orange-400" />
                  <div>
                    <p className="text-sm text-gray-500">기압</p>
                    <p>{selectedLocation.weather.pressure} hPa</p>
                  </div>
                </div>
              </div>

              {/* Sunrise/Sunset */}
              {selectedLocation.weather.sunrise && selectedLocation.weather.sunset && (
                <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">일출</p>
                    <p>{selectedLocation.weather.sunrise}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">일몰</p>
                    <p>{selectedLocation.weather.sunset}</p>
                  </div>
                </div>
              )}
            </Card>

            {/* 5-Day Forecast */}
            {selectedLocation.forecast && selectedLocation.forecast.length > 0 && (
              <Card className="p-4">
                <h3 className="mb-3">5일 예보</h3>
                <div className="space-y-2">
                  {selectedLocation.forecast.map((day, index) => {
                    const ForecastIcon = getWeatherIcon(day.condition);
                    const date = new Date(day.date);
                    const dateStr = index === 0 ? '오늘' : `${date.getMonth() + 1}/${date.getDate()}`;
                    
                    return (
                      <div
                        key={day.date}
                        className="flex items-center justify-between p-2 rounded hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <ForecastIcon className="w-5 h-5 text-blue-500" />
                          <span className="text-sm">{dateStr}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-red-500">{day.maxTemp}°</span>
                          <span className="text-gray-400">/</span>
                          <span className="text-blue-500">{day.minTemp}°</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}