import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import RegisterScreen from './screens/RegisterScreen';
import ResultScreen from './screens/ResultScreen';
import LoginScreen from './screens/LoginScreen';
import LiveScreen from './screens/LiveScreen';
import CrudScreen from './screens/CrudScreen';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const toastConfig = {
  error: (props) => (
    <ErrorToast
      {...props}
      style={{
        backgroundColor: '#000', // Light red background
      }}
      text1Style={{
        fontSize: 12,
        fontWeight: 'bold',
        color: '#fff',
      }}
      text2Style={{
        fontSize: 11,
        color: '#fff',
      }}
    />
  ),

  success: (props) => (
    <BaseToast
      {...props}
      style={{
        borderLeftColor: 'green',
        backgroundColor: '#000', // Light green background
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 12,
        fontWeight: 'bold',
        color: '#fff',
      }}
      text2Style={{
        fontSize: 11,
        color: '#fff',
      }}
    />
  ),
};

// Tab navigator for main app screens (after login)
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tab.Screen
        name="Présence"
        component={HomeScreen}
        options={{ unmountOnBlur: true }}
      />
      <Tab.Screen
        name="Live"
        component={LiveScreen}
        options={{ unmountOnBlur: true }}
      />
      <Tab.Screen
        name="Ajout"
        component={RegisterScreen}
        options={{ unmountOnBlur: true }}
      />
      <Tab.Screen
        name="Crud"
        component={CrudScreen}
        options={{ unmountOnBlur: true }}
      />
      <Tab.Screen
        name="Résultats"
        component={ResultScreen}
        options={{ unmountOnBlur: true }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ unmountOnBlur: true }}
          />
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ unmountOnBlur: true }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <Toast config={toastConfig} />
    </>
  );
}

