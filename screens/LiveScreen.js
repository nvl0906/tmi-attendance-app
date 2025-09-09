import { useState, useRef, useEffect } from 'react';
import { View, Text, SafeAreaView, Button, StyleSheet, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useIsFocused } from '@react-navigation/core';
import Toast from 'react-native-toast-message';
import { BACKEND_WS_URL } from '@env'

export default function LiveScreen({ route }) {
  const [facing, setFacing] = useState('back');
  const [isstarting, setIsstarting] = useState(false);
  const { emplacement, isadmin } = route.params || {};
  const [permission, requestPermission] = useCameraPermissions();
  const [newlymarked, setNewlymarked] = useState([]);
  const [alreadymarked, setAlreadymarked] = useState([]);
  const ws = useRef(null);
  const zoomTimeout = useRef();
  const [sliderZoom, setSliderZoom] = useState(0);
  const cameraRef = useRef(null);
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const [showCamera, setShowCamera] = useState(false);
  const [flash, setFlash] = useState('off');
  const [zoom, setZoom] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);

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

  useEffect(() => {
    if (isstarting && isFocused) {
      ws.current = new WebSocket(BACKEND_WS_URL);

      ws.current.onopen = () => {
        console.log("Connected to backend");
        setWsConnected(true);
      };

      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.status === 'success') {
          setNewlymarked(data.newly_marked || []);
          setAlreadymarked(data.already_marked || []);
        } else if (data.status === 'emplacement_mismatch') {
          Toast.show({
            type: 'error',
            text1: '❌ ' + data.messageemplacement,
            position: 'top',
            visibilityTime: 5000,
          });
          navigation.navigate('Présence', { isadmin: isadmin });
        }
      }

      ws.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.current.onclose = () => {
        setIsstarting(false);
        setWsConnected(false);
        console.log("Disconnected from backend");
      };

      return () => {
        if (ws.current) ws.current.close();
      };
    }
  }, [isstarting, isFocused]);

  // Send frames like a video stream
  useEffect(() => {
    let interval;
    if (isstarting && isFocused && wsConnected && permission && permission.granted) {
      interval = setInterval(async () => {
        if (cameraRef.current && ws.current?.readyState === WebSocket.OPEN) {
          try {
            const photo = await cameraRef.current.takePictureAsync({
              quality: 0.2, // lower for speed
              base64: true,
              skipProcessing: true,
            });
            ws.current.send(JSON.stringify({ image: photo.base64, emplacement }));
          } catch (err) {
            console.error("Capture error:", err);
          }
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isstarting, isFocused, wsConnected, permission]);

  const toggleFlash = () => {
    setFlash((prev) => {
      if (prev === 'off') return 'on';
      if (prev === 'on') return 'auto';
      if (prev === 'auto') return 'torch';
      return 'off';
    });
  };
  
  // Do not return early! Render conditionally below.
  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

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

          <View style={{ position: "absolute", bottom: 200, left: 20 }}>
            { newlymarked != 0 && <Text style={{ color: "white", fontSize: 10 }}> Présents:</Text> }
            {newlymarked.map((name, idx) => (
              <Text key={idx} style={{ color: "white", fontSize: 10 }}>
                {name}
              </Text>
            ))}
          </View>

          <View style={{ position: "absolute", bottom: 200, right: 20 }}>
            { alreadymarked != 0 && <Text style={{ color: "white", fontSize: 10 }}>Déjà présents:</Text> }
            {alreadymarked.map((name, idx) => (
              <Text key={idx} style={{ color: "white", fontSize: 10 }}>
                {name}
              </Text>
            ))}
          </View>

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
            <TouchableOpacity style={styles.flashButton} onPress={toggleFlash}>
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
            <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
              <MaterialCommunityIcons name="camera-flip" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={isstarting ? styles.videoonButton : styles.videooffButton}
            onPress={() => setIsstarting(!isstarting)}
          >
            {isstarting ? (<MaterialCommunityIcons name="crop-square" size={40} color="#fff" />):(<MaterialCommunityIcons name="camera" size={40} color="#fff" />)}
          </TouchableOpacity>
          <TouchableOpacity style={styles.liveButton} disabled={isstarting} onPress={() => navigation.navigate("Présence", { isadmin: isadmin })}>
            <MaterialCommunityIcons name="robot" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton} disabled={isstarting} onPress={() => navigation.navigate('Ajout', { isadmin: isadmin })}>
            <MaterialCommunityIcons name="account-plus" size={20} color="#fff" />
          </TouchableOpacity>
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
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
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
  videooffButton: {
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
  videoonButton: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: '#ff0000ff',
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
  }
});
