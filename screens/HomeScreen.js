import { useState, useRef, useEffect } from 'react';
import { View, Text, SafeAreaView, Button, TextInput, ActivityIndicator, Alert, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import Slider from '@react-native-community/slider';
import { CameraView, useCameraPermissions } from 'expo-camera';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useIsFocused } from '@react-navigation/core';
import Toast from 'react-native-toast-message';
import { Audio } from 'expo-av';
import * as Location from 'expo-location'; // Import Location for geolocation
import { BACKEND_URL } from '@env'

export default function HomeScreen({ route }) {
  // All hooks must be called before any return
  const { isadmin } = route.params || {};
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [emplacement, setEmplacement] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [flash, setFlash] = useState('off');
  const [zoom, setZoom] = useState(0); // actual camera zoom
  const [sliderZoom, setSliderZoom] = useState(0); // UI slider value
  const [showCamera, setShowCamera] = useState(false); // for delayed camera mount
  const [showLive, setShowLive] = useState(false);
  const [timer, setTimer] = useState(0); // retardataire seconds (0 = no timer)
  const [countdown, setCountdown] = useState(0); // current countdown
  const zoomTimeout = useRef();
  const cameraRef = useRef(null);
  const navigation = useNavigation();
  const [showTimerOptions, setShowTimerOptions] = useState(false);
  const timerAnim = useRef(new Animated.Value(0)).current; // 0: hidden, 1: visible
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  
  const isFocused = useIsFocused();
  const formattedEmplacement = emplacement
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Delay camera mount after focus/permission to avoid black screen
  useEffect(() => {
    let timeout;
    if (isFocused && permission?.granted) {
      timeout = setTimeout(() => setShowCamera(true), 200); // 200ms delay
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

  useEffect(() => {
    if (formattedEmplacement.length > 2) {
      setShowLive(true);
    } else {
      setShowLive(false);
    }
  }, [formattedEmplacement]);

  const updateGeolocation = async () => {
    setLatitude(0);
    setLongitude(0);
    let geolocation = await Location.getCurrentPositionAsync({});
    if (geolocation && geolocation.coords) {
      setLatitude(geolocation.coords.latitude);
      setLongitude(geolocation.coords.longitude);
    }
  }

  const toggleFlash = () => {
    setFlash((prev) => {
      if (prev === 'off') return 'on';
      if (prev === 'on') return 'auto';
      if (prev === 'auto') return 'torch';
      return 'off';
    });
  };

  const playShutterSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/shutter.wav') // adjust path as needed
        );
        await sound.playAsync();
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) sound.unloadAsync();
        });
      } catch (e) {
        // Handle error silently
      }
    };

  // Do not return early! Render conditionally below.
  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  const handleCaptureAndSend = async () => {
    setIsLoading(true);
    try {
      if (!cameraRef.current) throw new Error("Camera is not ready.");
      if (!formattedEmplacement || formattedEmplacement.length < 2) {
        setIsLoading(false)
        Toast.show({
          type: 'error',
          text1: '❌ Veuillez entrer votre emplacement actuel svp!',
          position: 'top',
        });
        return;
      }

      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.3, shutterSound: false });

      const formData = new FormData();
      formData.append('file', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: 'student.jpg',
      });
      formData.append('emplacement', formattedEmplacement);
      formData.append('latitude', parseFloat(latitude));
      formData.append('longitude', parseFloat(longitude));

      const response = await axios.post(`${BACKEND_URL}/recognize`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { status, newly_marked, already_marked, messagenoface, messagenomatch, messageemplacement, messageliveness, messagedistance, messagenoadmin } = response.data;

      if (status === 'success') {
        const totalNew = newly_marked?.length || 0;
        const totalAlready = already_marked?.length || 0;

        Toast.show({
          type: 'success',
          text1: '📋 Total',
          text2: `✅ ${totalNew} présents  •  ⚠️ ${totalAlready} déjà présents`,
          visibilityTime: 3000,
          position: 'top',
          autoHide: true,
          topOffset: 60,
        });

        navigation.navigate('Résultats', {
          newlyMarked: newly_marked || [],
          alreadyMarked: already_marked || [],
          isadmin: isadmin,
        });

      } else if (status === 'distance') {
        Toast.show({
          type: 'error',
          text1: '❌ ' + messagedistance,
          position: 'top',
        });
      } else if (status === 'noadmin') {
        Toast.show({
          type: 'error',
          text1: '❌ ' + messagenoadmin,
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
      } else if (status === 'nomatch') {
        Toast.show({
          type: 'error',
          text1: '❌ ' + messagenomatch,
          position: 'top',
        });
      } else if (status === 'emplacement_mismatch') {
        Toast.show({
          type: 'error',
          text1: '❌ ' + messageemplacement,
          position: 'top',
        });
      }
    } catch (err) {
      console.error("Capture Error:", err);
      Alert.alert('Erreur', err.message || 'Une erreur est survenue.');
    } finally {
      setIsLoading(false); // ✅ always called now
    }
  };

  const downloadAndShare = async () => {
    setIsLoading(true);
    try {
      const fileName = "tmi_presence.xlsx";
      const fileUri = FileSystem.cacheDirectory + fileName;

      // ⬇️ Download file from backend
      const response = await FileSystem.downloadAsync(
        `${BACKEND_URL}/download`,
        fileUri
      );

      console.log("✅ Fichier téléchargé sur", response.uri);

      // ⬇️ Check file existence
      const fileInfo = await FileSystem.getInfoAsync(response.uri);
      if (!fileInfo.exists) throw new Error("Fichier introuvable");

      // ⬇️ Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(response.uri, {
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Partager la feuille de présence',
          UTI: 'com.microsoft.excel.xlsx',
        });
      } else {
        Alert.alert(
          'Partage non disponible',
          'Impossible de partager ce fichier sur cet appareil.'
        );
      }

    } catch (error) {
      console.error("❌ Erreur:", error);
      Alert.alert("Erreur", error.message || "Impossible de partager le fichier.");
    } finally {
      setIsLoading(false); // ✅ always stop spinner
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
            handleCaptureAndSend();
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } else {
      playShutterSound();
      handleCaptureAndSend();
    }
  };

// ...existing code...

  return (
    <SafeAreaView style={styles.container}>
      {/* Permission loading or not granted UI */}
      {!permission ? (
        <View style={styles.permission} />
      ) : !permission.granted ? (
        <View style={styles.permission}>
          <Text style={styles.message}>Nous avons besoin de votre permission pour accéder à votre camera svp!</Text>
          <Button style={styles.messageButton} onPress={requestPermission} title="Donner permission" />
        </View>
      ) : (
        <>
          {/* Show typed emplacement in the screen */}
          {emplacement.length > 0 && (
            <View style={styles.centeredTextOverlay}>
              <Text style={styles.centeredText}>{emplacement}</Text>
            </View>
          )}

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
              style={styles.camera}
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

          {/* Top Controls */}
          <View style={styles.topControls}>
            { isadmin && (
              <TouchableOpacity
                style={styles.downloadButton}
                onPress={downloadAndShare}
                disabled={isLoading || countdown > 0}
              >
                <MaterialCommunityIcons name="download" size={20} color="#fff" />
              </TouchableOpacity>
            )}

            <TextInput
              style={styles.topInput}
              placeholder="Emplacement..."
              placeholderTextColor="#ccc"
              value={emplacement}
              onChangeText={setEmplacement}
            />
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
            {/* Timer button */}
            <TouchableOpacity
              style={ styles.timerButton}
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
            <MaterialCommunityIcons name="map-marker-radius" size={20} color={latitude == 0 ? "#fff" : "#00f54aff"}/>
          </TouchableOpacity>

          { latitude != 0 && (<TouchableOpacity
            style={styles.shutterButton}
            onPress={handleShutterPress}
            disabled={isLoading || countdown > 0}
          >
            <MaterialCommunityIcons name="camera" size={40} color="#fff" />
          </TouchableOpacity>)}
          { showLive && isadmin && (<TouchableOpacity style={styles.liveButton} disabled={isLoading || countdown > 0} onPress={() => navigation.navigate("Live", { emplacement: formattedEmplacement, isadmin: isadmin })}>
            <MaterialCommunityIcons name="record-rec" size={20} color="#fff" />
          </TouchableOpacity>)}
          {isadmin && (
            <TouchableOpacity style={styles.navButton} disabled={isLoading || countdown > 0} onPress={() => navigation.navigate('Ajout', { isadmin: isadmin })}>
              <MaterialCommunityIcons name="account-plus" size={20} color="#fff" />
            </TouchableOpacity>
          )}

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
  centeredTextOverlay: {
    position: 'absolute',
    top: 100, left: 0, right: 0, bottom: 0,
    zIndex: 50,
    pointerEvents: 'none',
  },
  centeredText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: 'bold',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
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
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
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
  downloadButton: {
    backgroundColor: '#00000088',
    padding: 10,
    borderRadius: 30,
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
  },
  timerButton: {
    backgroundColor: '#00000088',
    padding: 10,
    borderRadius: 30,
    marginLeft: 5,
  },
  captureButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
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
  captureText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
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
  navButton: {
    position: 'absolute',
    bottom: 60,
    right: 10,
    alignSelf: 'center',
    backgroundColor: '#00000088',
    padding: 18,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
  liveButton: {
    position: 'absolute',
    bottom: 60,
    left: 10,
    alignSelf: 'center',
    backgroundColor: '#00000088',
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
  }
});