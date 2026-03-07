import { useState, useEffect } from "react";

const useGeolocation = () => {
  const [location, setLocation] = useState({
    loaded: false,
    coordinates: { lat: "", lng: "" },
    accuracy: null,
  });
  const [error, setError] = useState(null);

  const onSuccess = (location) => {
    setError(null);
    setLocation({
      loaded: true,
      coordinates: {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      },
      accuracy: location.coords.accuracy,
    });
  };

  const onError = (error) => {
    setError(error);
  };

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      onError({
        code: 0,
        message: "Geolocation not supported",
      });
      return;
    }

    const watcher = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
    });

    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  return { ...location, error };
};

export default useGeolocation;
