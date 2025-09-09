import { useState, useRef, useEffect } from 'react';
import { View, Text, SafeAreaView, Button, TextInput, ActivityIndicator, Alert, StyleSheet, TouchableOpacity, Modal, Pressable, Animated, Easing } from 'react-native';
import Slider from '@react-native-community/slider';
import { CameraView, useCameraPermissions } from 'expo-camera';
import axios from 'axios';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useIsFocused } from '@react-navigation/core';
import Toast from 'react-native-toast-message';
import { Audio } from 'expo-av';
import { BACKEND_URL } from '@env'

export default function RegisterScreen({ route }) {
  const { isadmin } = route.params || {};
  const [facing, setFacing] = useState('back');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const cameraRef = useRef(null);
  const [flash, setFlash] = useState('off');
  const [voice, setVoice] = useState(1); // default value 1
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [zoom, setZoom] = useState(0); // actual camera zoom
  const [sliderZoom, setSliderZoom] = useState(0); // UI slider value
  const [showCamera, setShowCamera] = useState(false); // for delayed camera mount
  const [permission, requestPermission] = useCameraPermissions();
  const zoomTimeout = useRef();
  const [timer, setTimer] = useState(0); // retardataire seconds (0 = no timer)
  const [countdown, setCountdown] = useState(0); // current countdown
  const [showTimerOptions, setShowTimerOptions] = useState(false);
  const timerAnim = useRef(new Animated.Value(0)).current;
  const formattedName = username
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  const navigation = useNavigation();
  const isFocused = useIsFocused();

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

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

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

  const handleCaptureAndSend = async () => {
    setIsLoading(true);
    try {
      if (!cameraRef.current) {
        throw new Error("La caméra n'est pas prête.");
      }

      if (!formattedName || formattedName.length < 2) {
        setIsLoading(false);
        Toast.show({
          type: 'error',
          text1: '❌ Veuillez entrer votre prénom svp!',
          text2: '❌ Et choisir votre voix!',
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
      formData.append('name', formattedName);
      formData.append('voice', voice);

      const response = await axios.post(`${BACKEND_URL}/register`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.status === 'success') {
        Toast.show({
          type: 'success',
          text1: `✅ ${response.data.name} ajouté avec succès`,
          position: 'top',
          visibilityTime: 4000,
          topOffset: 60,
        });
      } else if (response.data.status === 'username') {
        Toast.show({
          type: 'error',
          text1: '❌ ' + response.data.messageusername,
          position: 'top',
        });
      } else if (response.data.status === 'liveness') {
        Toast.show({
          type: 'error',
          text1: '❌ ' + response.data.messageliveness,
          position: 'top',
        });
      } else if (response.data.status === 'noface') {
        Toast.show({
          type: 'error',
          text1: '❌ Aucun visage détecté!',
          position: 'top',
        });
      } else if (response.data.status === 'lotface') {
        Toast.show({
          type: 'error',
          text1: '❌ Beaucoup de visage détecté!',
          position: 'top',
        });
      } else if (response.data.status === 'existingface') {
        Toast.show({
          type: 'error',
          text1: `❌ Visage déjà existant avec le prénom ${response.data.nameexisting}!`,
          position: 'top',
        });
      }

    } catch (err) {
      console.error("Erreur lors de l'ajout:", err);
      Alert.alert('Erreur', err.message || "Une erreur est survenue.");
    } finally {
      setIsLoading(false); // ✅ always reset
    }
  };

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
          {/* Show typed username in the screen */}
          {username.length > 0 && (
            <View style={styles.centeredTextOverlay}>
              <Text style={styles.centeredText}>{username}</Text>
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

          {/* Top Controls Row */}
          <View style={styles.topControls}>
            {/* Arrow-down button for dropdown and voice value */}
            <TouchableOpacity style={styles.iconButton} onPress={() => setDropdownVisible(true)} disabled={isLoading || countdown > 0}>
              <MaterialCommunityIcons name="chevron-down" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.voiceValue}>{voice}</Text>
            {/* Dropdown modal */}
            <Modal
              transparent
              visible={dropdownVisible}
              animationType="fade"
              onRequestClose={() => setDropdownVisible(false)}
            >
              <Pressable style={styles.modalOverlay} onPress={() => setDropdownVisible(false)} disabled={isLoading || countdown > 0}>
                <View style={styles.dropdownMenu}>
                  {[1,2,3,4].map((v) => (
                    <TouchableOpacity
                      key={v}
                      style={[styles.dropdownItem, v === voice && styles.dropdownItemSelected]}
                      onPress={() => { setVoice(v); setDropdownVisible(false); }}
                    >
                      <Text style={{ color: v === voice ? '#1e90ff' : '#fff', fontWeight: v === voice ? 'bold' : 'normal' }}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Pressable>
            </Modal>
            <TextInput
              style={styles.topInput}
              placeholder="Prénom..."
              placeholderTextColor="#ccc"
              value={username}
              onChangeText={setUsername}
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
            <TouchableOpacity style={styles.iconButton} onPress={toggleCameraFacing} disabled={isLoading || countdown > 0}>
              <MaterialCommunityIcons name="camera-flip" size={20} color="#fff" />
            </TouchableOpacity>
            {/* Timer button */}
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
          <TouchableOpacity style={styles.crudButton} disabled={isLoading || countdown > 0} onPress={() => navigation.navigate('Crud', { isadmin: isadmin })}>
            <MaterialCommunityIcons name="database-edit" size={20} color="#fff"/>
          </TouchableOpacity>
          {/* Shutter Button */}
          <TouchableOpacity
            style={styles.shutterButton}
            onPress={handleShutterPress}
            disabled={isLoading || countdown > 0}
          >
            <MaterialCommunityIcons name="camera" size={40} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton} disabled={isLoading || countdown > 0} onPress={() => navigation.navigate('Présence', { isadmin: isadmin })}>
            <MaterialCommunityIcons name="robot" size={20} color="#fff" />
          </TouchableOpacity>
          {/* Fullscreen Loading Spinner */}
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
  camera: {
    flex: 1,
  },
  voiceValue: {
    color: '#fff',
    fontSize: 16,
    marginHorizontal: 2,
    minWidth: 18,
    textAlign: 'center',
    fontWeight: 'bold',
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
  flashButton: {
    backgroundColor: '#00000088',
    padding: 10,
    marginRight:5,
    borderRadius: 30,
  },
  iconButton: {
    backgroundColor: '#00000088',
    padding: 10,
    borderRadius: 30,
    marginRight: 5,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
  },
  dropdownMenu: {
    backgroundColor: '#222',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 20,
    minWidth: 80,
    elevation: 10,
    marginTop: 60,
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  dropdownItemSelected: {
    backgroundColor: '#fff2',
    borderRadius: 8,
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
  crudButton: {
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
});
