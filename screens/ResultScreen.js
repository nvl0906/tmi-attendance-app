import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity  } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ResultScreen({ route }) {
    const { newlyMarked = [], alreadyMarked = [], isadmin } = route.params || {};
    const navigation = useNavigation();
  
    return (
    <View style={styles.container}>
      {/* 🔙 Back Arrow */}
      <TouchableOpacity onPress={() => navigation.navigate('Présence',{
          isadmin: isadmin,
        })} style={styles.backButton}>
        <MaterialCommunityIcons name="arrow-left" size={26} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.title}>Résultats de reconnaissance</Text>

      <ScrollView style={styles.scroll}>
        {newlyMarked.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✅ Présents:</Text>
            {newlyMarked.map((name, index) => (
              <Text key={index} style={styles.name}>• {name}</Text>
            ))}
          </View>
        )}

        {alreadyMarked.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚠️ Déjà présents:</Text>
            {alreadyMarked.map((name, index) => (
              <Text key={index} style={styles.name}>• {name}</Text>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50, paddingHorizontal: 20, backgroundColor: '#000' },
  backButton: { position: 'absolute', top: 58, left: 10, zIndex: 10 },
  title: { fontSize: 18, fontWeight: 'bold', marginTop: 10, textAlign: 'center', color: '#fff' },
  scroll: { marginTop: 20},
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 5, color: '#fff' },
  name: { fontSize: 14, color: '#fff'},
});
