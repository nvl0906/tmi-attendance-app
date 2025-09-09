import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import axios from 'axios';
import Toast from 'react-native-toast-message';
import { BACKEND_URL } from '@env'

export default function CrudScreen({ route }) {
  const { isadmin } = route.params || {};
  const navigation = useNavigation();

  const [search, setSearch] = useState('');
  const [userResult, setUserResult] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [newName, setNewName] = useState('');
  const [newVoice, setNewVoice] = useState(1);
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const formattednewName = newName
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Search handler
  const handleSearch = async (text) => {
    setSearch(text);
    setUserResult(null);
    if (text.length < 2) return;
    setLoading(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/search-user`, { name: text });
      setUserResult(res.data || []);
    } catch (e) {
      setUserResult([]);
    }
    setLoading(false);
  };

  // Delete handler
  const handleDelete = async (user_id, user_name) => {
    setLoading(true);
    try {
      res = await axios.post(`${BACKEND_URL}/delete-user`, { id: user_id, name: user_name });
      const { status, message } = res.data;

    if (status === 'success') {
        Toast.show({
            type: 'success',
            text1: '✅ ' + message,
            visibilityTime: 3000,
            position: 'top',
            autoHide: true,
            topOffset: 60,
        });
    }
      setUserResult([]);
      setSearch('');
      // Optionally show a toast here
    } catch (e) {
      // Optionally show an error toast
    }
    setLoading(false);
  };

  // Update handler (now includes voice and is_admin)
  const handleUpdate = async (user_id, newName, newVoice, newIsAdmin) => {
    setLoading(true);
    try {
      res = await axios.post(`${BACKEND_URL}/update-user`, { id: user_id, name: newName, voice: newVoice, is_admin: newIsAdmin });
      const { status, message } = res.data;

    if (status === 'success') {
        Toast.show({
            type: 'success',
            text1: '✅ ' + message,
            visibilityTime: 3000,
            position: 'top',
            autoHide: true,
            topOffset: 60,
        });
    } else if (status === 'error') {
        Toast.show({
            type: 'error',
            text1: '❌ ' + message,
            position: 'top',
            visibilityTime: 3000,
            autoHide: true,
            topOffset: 60,
        });
    } 

      // Optionally update userResult state here if you want instant UI update
      setUserResult([]);
      setSearch('');
      // Optionally show a toast here
    } catch (e) {
      // Optionally show an error toast
    }
    setLoading(false);
  };

  const renderListItem = ({ item }) => (
    <View style={styles.userCard}>
      <Text style={styles.name}>{item.username}</Text>
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.id, item.username)}
        >
          <MaterialCommunityIcons name="delete" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setEditUser(item);
            setNewName(item.username);
            setNewVoice(item.voice || 1);
            setNewIsAdmin(!!item.is_admin);
            setModalVisible(true);
          }}
        >
          <MaterialCommunityIcons name="pencil" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 🔙 Back Arrow */}
      <TouchableOpacity onPress={() => navigation.navigate('Ajout', { isadmin })} style={styles.backButton}>
        <MaterialCommunityIcons name="arrow-left" size={26} color="#fff" />
      </TouchableOpacity>

      <Text style={styles.title}>Opération</Text>

      <View style={styles.scroll}>
        {/* Search Bar */}
        <TextInput
          style={styles.searchBar}
          placeholder="Rechercher un utilisateur..."
          placeholderTextColor="#aaa"
          value={search}
          onChangeText={handleSearch}
        />
        {loading && <ActivityIndicator color="#1e90ff" style={{ marginTop: 10 }} />}
        {/* User Result */}
        {userResult && userResult.length > 0 && !loading && (
            <FlatList
                data={userResult}
                renderItem={renderListItem}
                keyExtractor={item => item.id.toString()}
            />
        )}
      </View>

        {/* Edit Modal */}
        <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={{
          flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000a'
        }}>
          <View style={{
            backgroundColor: '#222', padding: 20, borderRadius: 10, width: '80%'
          }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 10 }}>Nouveau prénom</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              style={{
                backgroundColor: '#333', color: '#fff', borderRadius: 8, padding: 10, marginBottom: 15
              }}
              placeholder="Entrer le nouveau nom"
              placeholderTextColor="#aaa"
            />
            <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 10 }}>Voix</Text>
            <View style={{ flexDirection: 'row', marginBottom: 15 }}>
              {[1, 2, 3, 4].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginRight: 15,
                  }}
                  onPress={() => setNewVoice(v)}
                >
                  <View style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: '#1e90ff',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 5,
                    backgroundColor: newVoice === v ? '#1e90ff' : 'transparent',
                  }}>
                    {newVoice === v && (
                      <View style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: '#fff',
                      }} />
                    )}
                  </View>
                  <Text style={{ color: '#fff' }}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
              <TouchableOpacity
                onPress={() => setNewIsAdmin(!newIsAdmin)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: '#1e90ff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                  backgroundColor: newIsAdmin ? '#1e90ff' : 'transparent',
                }}
              >
                {newIsAdmin && (
                  <MaterialCommunityIcons name="check" size={18} color="#fff" />
                )}
              </TouchableOpacity>
              <Text style={{ color: '#fff' }}>Admin</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#444' }]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={{ color: '#fff' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={async () => {
                  await handleUpdate(editUser.id, formattednewName, newVoice, newIsAdmin);
                  setModalVisible(false);
                }}
              >
                <Text style={{ color: '#fff' }}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50, paddingHorizontal: 20, backgroundColor: '#000' },
  backButton: { position: 'absolute', top: 58, left: 10, zIndex: 10 },
  title: { fontSize: 18, fontWeight: 'bold', marginTop: 10, textAlign: 'center', color: '#fff' },
  scroll: { marginTop: 20 },
  searchBar: {
    backgroundColor: '#222',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 15,
  },
  userCard: {
    flexDirection: 'row',
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  actionContainer: {
    flexDirection: 'row',
    position: 'absolute',
    right: 10,
    top: '120%',
    transform: [{ translateY: -20 }],
  },
  name: { fontSize: 16, color: '#fff', fontWeight: 'bold' },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e90ff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 5,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff311eff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 5,
  },
});