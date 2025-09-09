import { useState, useRef, useEffect } from 'react';
import { View, Text, SafeAreaView, Button, ActivityIndicator, Alert, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import Slider from '@react-native-community/slider';
import { CameraView, useCameraPermissions } from 'expo-camera';
import axios from 'axios';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useIsFocused } from '@react-navigation/core';
import Toast from 'react-native-toast-message';
import { Audio } from 'expo-av';
import * as Location from 'expo-location'; // Import Location for geolocation
import { BACKEND_URL } from '@env'

export default function LoginScreen() {
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isLoading, setIsLoading] = useState(false);
  const [flash, setFlash] = useState('off');
  const [zoom, setZoom] = useState(0);
  const [sliderZoom, setSliderZoom] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const zoomTimeout = useRef();
  const cameraRef = useRef(null);
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [timer, setTimer] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [showTimerOptions, setShowTimerOptions] = useState(false);
  const timerAnim = useRef(new Animated.Value(0)).current;
  const locationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return False
    } else {
      return True
    }
  }

  // Delay camera mount after focus/permission to avoid black screen
  useEffect(() => {
    let timeout;

    if (isFocused && permission?.granted && locationPermission()) {
      timeout = setTimeout(() => setShowCamera(true), 200);
    } else {
      setShowCamera(false);
    }
    return () => clearTimeout(timeout);
  }, [isFocused, permission]);

  // Debounce slider -> zoom
  useEffect(() => {
    if (zoomTimeout.current) clearTimeout(zoomTimeout.current);
    zoomTimeout.current = setTimeout(() => {
      setZoom(sliderZoom);
    }, 100);
    return () => clearTimeout(zoomTimeout.current);
  }, [sliderZoom]);

  // Animate timer options in/out
  useEffect(() => {
    if (showTimerOptions) {
      Animated.timing(timerAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
        easing: Easing.out(Easing.exp),
      }).start();
    } else {
      Animated.timing(timerAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.in(Easing.exp),
      }).start();
    }
  }, [showTimerOptions, timerAnim]);

  // Auto-hide timer options after 2 seconds
  useEffect(() => {
    let timeout;
    if (showTimerOptions) {
      timeout = setTimeout(() => setShowTimerOptions(false), 2000);
    }
    return () => clearTimeout(timeout);
  }, [showTimerOptions]);

  const toggleFlash = () => {
    setFlash((prev) => {
      if (prev === 'off') return 'on';
      if (prev === 'on') return 'auto';
      if (prev === 'auto') return 'torch';
      return 'off';
    });
  };

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  const playShutterSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../assets/shutter.wav')
      );
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) sound.unloadAsync();
      });
    } catch (e) {
      // Handle error silently
    }
  };

  // Timer/retardataire shutter logic
  const handleShutterPress = () => {
    if (timer > 0) {
      setCountdown(timer);
      const interval = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(interval);
            playShutterSound();
            handleLogin();
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } else {
      playShutterSound();
      handleLogin();
    }
  };

  const updateGeolocation = async () => {

    let geolocation = await Location.getCurrentPositionAsync({});
    setLatitude(geolocation.coords.latitude);
    setLongitude(geolocation.coords.longitude);
  }

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      if (!cameraRef.current) throw new Error("Camera is not ready.");

      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.3, shutterSound: false });

      const formData = new FormData();
      formData.append('file', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: 'student.jpg',
      });
      formData.append('latitude', parseFloat(latitude));
      formData.append('longitude', parseFloat(longitude));

      const response = await axios.post(`${BACKEND_URL}/login`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { status, messagenoface, messagelotface, messageadmin, messagenotadmin, messageliveness, messagenotfound, messagemember } = response.data;

      if (status === 'successadmin') {
        Toast.show({
          type: 'success',
          text1: '✅ ' + messageadmin,
          visibilityTime: 3000,
          position: 'top',
          autoHide: true,
          topOffset: 60,
        });
        navigation.replace('MainTabs', {
          screen: "Présence", // Target a tab inside the navigator
          params: {
            isadmin: true,
          },
        });

      } else if (status === 'successmember') {
        Toast.show({
          type: 'success',
          text1: '✅ ' + messagemember,
          visibilityTime: 3000,
          position: 'top',
          autoHide: true,
          topOffset: 60,
        });
        navigation.replace('MainTabs', {
          screen: "Présence", // Target a tab inside the navigator
          params: {
            isadmin: false,
          },
        });

      } else if (status === 'notfound') {
        Toast.show({
          type: 'error',
          text1: '❌ ' + messagenotfound,
          position: 'top',
        });
      } else if (status === 'liveness') {
        Toast.show({
          type: 'error',
          text1: '❌ ' + messageliveness,
          position: 'top',
        });
      } else if (status === 'noface') {
        Toast.show({
          type: 'error',
          text1: '❌ ' + messagenoface,
          position: 'top',
        });
      } else if (status === 'lotface') {
        Toast.show({
          type: 'error',
          text1: '❌ ' + messagelotface,
          position: 'top',
        });
      } else if (status === 'notadmin') {
        Toast.show({
          type: 'error',
          text1: '❌ ' + messagenotadmin,
          position: 'top',
        });
      }
    } catch (err) {
      console.error("Capture Error:", err);
      Alert.alert('Erreur', err.message || 'Une erreur est survenue.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {!permission ? (
        <View style={styles.permission} />
      ) : !permission.granted ? (
        <View style={styles.permission}>
          <Text style={styles.message}>Nous avons besoin de votre permission pour accéder à votre camera svp!</Text>
          <Button style={styles.messageButton} onPress={requestPermission} title="Donner permission" />
        </View>
      ) : (
        <>
          {/* Countdown overlay */}
          {countdown > 0 && (
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              justifyContent: 'center', alignItems: 'center', zIndex: 100,
            }}>
              <Text style={{ fontSize: 80, color: '#fff', fontWeight: 'bold' }}>{countdown}</Text>
            </View>
          )}

          {showCamera && (
            <CameraView
              style={StyleSheet.absoluteFill}
              ref={cameraRef}
              facing={facing}
              enableTorch={flash === 'torch'}
              flash={flash}
              zoom={zoom}
            />
          )}

          {/* Zoom Slider */}
          <View style={styles.zoomContainer}>
            <MaterialCommunityIcons name="magnify-minus-outline" size={18} color="#fff" />
            <Slider
              style={styles.zoomSlider}
              minimumValue={0}
              maximumValue={1}
              value={sliderZoom}
              onValueChange={setSliderZoom}
              minimumTrackTintColor="#1e90ff"
              maximumTrackTintColor="#fff"
              thumbTintColor="#1e90ff"
            />
            <MaterialCommunityIcons name="magnify-plus-outline" size={18} color="#fff" />
          </View>
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.flashButton} onPress={toggleFlash} disabled={isLoading || countdown > 0}>
              <MaterialCommunityIcons
                name={
                  flash === 'off'
                    ? 'flash-off'
                    : flash === 'on'
                    ? 'flash'
                    : flash === 'auto'
                    ? 'flash-auto'
                    : 'flashlight'
                }
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing} disabled={isLoading || countdown > 0}>
              <MaterialCommunityIcons name="camera-flip" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.timerButton}
              onPress={() => setShowTimerOptions((v) => !v)}
              disabled={isLoading || countdown > 0}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', width: 25, textAlign: 'center'}}>{`${timer}s`}</Text>
            </TouchableOpacity>
          </View>

          {/* Animated Timer/retardataire buttons */}
          <Animated.View
            pointerEvents={showTimerOptions ? 'auto' : 'none'}
            style={[
              styles.animatedTimerOptions,
              {
                opacity: timerAnim,
                transform: [
                  {
                    translateY: timerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-30, 0],
                    }),
                  },
                  {
                    scale: timerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.95, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {[0, 3, 5, 10].map((t) => (
              <TouchableOpacity
                key={t}
                style={{
                  backgroundColor: timer === t ? '#1e90ff' : '#00000088',
                  padding: 10,
                  borderRadius: 20,
                  marginHorizontal: 5,
                  minWidth: 40,
                  alignItems: 'center',
                }}
                onPress={() => setTimer(t)}
                disabled={isLoading || countdown > 0}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t === 0 ? '⏱️' : `${t}s`}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>

          <TouchableOpacity style={styles.locationButton} disabled={isLoading || countdown > 0} onPress={() => updateGeolocation()}>
            <MaterialCommunityIcons name="map-marker-radius" size={20} color={latitude == 0 ? "#fff" : "#00f54aff"} />
          </TouchableOpacity>

          { longitude != 0 && (<TouchableOpacity
            style={styles.shutterButton}
            onPress={handleShutterPress}
            disabled={isLoading || countdown > 0}
          >
            <MaterialCommunityIcons name="camera" size={40} color="#fff" />
          </TouchableOpacity>)}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  zoomContainer: {
    position: 'absolute',
    bottom: 120,
    left: 30,
    right: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  zoomSlider: {
    flex: 1,
    marginHorizontal: 10,
    height: 40,
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
  },
  camera: {
    flex: 1,
  },
  topControls: {
    position: 'absolute',
    top: 50,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  locationButton: {
    position: 'absolute',
    bottom: 250,
    right: 10,
    alignSelf: 'center',
    backgroundColor: '#00000088',
    padding: 18,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  topInput: {
    flex: 1,
    marginHorizontal: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#00000088',
    color: '#fff',
    borderRadius: 10,
    fontSize: 14,
  },
  flashButton: {
    backgroundColor: '#00000088',
    padding: 10,
    marginRight:5,
    borderRadius: 30,
  },
  flipButton: {
    backgroundColor: '#00000088',
    padding: 10,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerButton: {
    backgroundColor: '#00000088',
    padding: 10,
    borderRadius: 30,
    marginLeft: 5,
  },
  shutterButton: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: '#1e90ff',
    padding: 18,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 20,
  },
  animatedTimerOptions: {
    position: 'absolute',
    top: 100,
    right: 10,
    left: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.0)',
  },
});