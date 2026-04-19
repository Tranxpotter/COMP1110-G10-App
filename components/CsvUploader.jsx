import React, { useState } from 'react';
import { View, Button, Text, StyleSheet, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Papa from 'papaparse';
import { useCsvImport } from '../hooks/useCsvImport';

const CsvUploader = () => {
  const [fileName, setFileName] = useState('');
  const { importCsv } = useCsvImport();

  // safe read string helper
  async function readString(path) {
    try {
      const enc = FileSystem?.EncodingType?.UTF8;
      if (enc) return await FileSystem.readAsStringAsync(path, { encoding: enc });
    } catch (e) {
      console.warn('readAsStringAsync with EncodingType.UTF8 failed, falling back', e);
    }
    return await FileSystem.readAsStringAsync(path);
  }

  // fallback copy/download to cache, error handling
  async function saveToCache(uri, name) {
    const safeName = name || `upload-${Date.now()}.csv`;
    const cacheDest = `${FileSystem.cacheDirectory}${safeName}`;
    try {
      await FileSystem.downloadAsync(uri, cacheDest);
      return cacheDest;
    } catch (e) {
      console.warn('downloadAsync failed, trying copyAsync if available', e);
      if (typeof FileSystem.copyAsync === 'function') {
        await FileSystem.copyAsync({ from: uri, to: cacheDest });
        return cacheDest;
      }
      throw e;
    }
  }

  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
      console.log('DocumentPicker result:', result);

      const asset = Array.isArray(result.assets) ? result.assets[0] : result;
      if (!asset || result.type === 'cancel' || result.canceled) {
        Alert.alert('Cancelled', 'File picker was cancelled.');
        return;
      }

      const uri = asset.uri;
      const name = asset.name || asset.fileName || (uri ? uri.split('/').pop() : 'file');
      setFileName(name);

      // Attempt multiple read strategies, including blob/text, File API if present, fallback to FileSystem
      let text = null;

      // 1) fetch + text()
      try {
        const res = await fetch(uri);
        // try res.text() first
        if (typeof res.text === 'function') {
          text = await res.text();
        }
        // if not available, try blob().text()
        if (!text && typeof res.blob === 'function') {
          const b = await res.blob();
          if (b && typeof b.text === 'function') {
            text = await b.text();
          }
        }
      } catch (e) {
        console.warn('fetch(uri) failed or res.text() unavailable', e);
      }

      // 2) try FileSystem read
      if (!text) {
        try {
          text = await readString(uri);
        } catch (e) {
          console.warn('readString(uri) failed', e);
        }
      }

      // 3) try File API exposed by expo-file-system (if available)
      if (!text && FileSystem && typeof FileSystem.File === 'function') {
        try {
          let fileObj = null;
          try { fileObj = new FileSystem.File(uri); } catch (_) { /* ignore */ }
          try { if (!fileObj) fileObj = new FileSystem.File({ uri }); } catch (_) { /* ignore */ }
          // some implementations expose text()
          if (fileObj && typeof fileObj.text === 'function') {
            text = await fileObj.text();
          }
        } catch (e) {
          console.warn('FileSystem.File attempt failed', e);
        }
      }

      // 4) copy/download to cache then read
      if (!text) {
        try {
          const cached = await saveToCache(uri, name);
          text = await readString(cached);
        } catch (e) {
          console.warn('saveToCache/read fallback failed', e);
        }
      }

      if (!text) {
        Alert.alert('File access error', 'Could not read the selected file. See console.');
        return;
      }

      // parse CSV (header autodetect)
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      if (parsed.errors && parsed.errors.length) {
        console.warn('CSV parse errors', parsed.errors);
        Alert.alert('CSV parse warning', String(parsed.errors[0].message || parsed.errors[0]));
        // continue to import attempt even if warnings present
      }

      // try import hook
      try {
        await importCsv(uri, text, parsed.data);
      } catch (e) {
        console.warn('importCsv(uri, text) failed, trying importCsv(text)', e);
        try {
          await importCsv(text, parsed.data);
        } catch (e2) {
          console.error('importCsv failed', e2);
          Alert.alert('Import failed', 'CSV import failed. See console.');
          return;
        }
      }

      Alert.alert('Imported', `Imported ${name}`);
    } catch (err) {
      console.error('DocumentPicker error', err);
      Alert.alert('Error', String(err));
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Upload CSV" onPress={handleFileUpload} />
      {fileName ? <Text style={styles.fileName}>Selected: {fileName}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16 },
  fileName: { marginTop: 12, fontSize: 14 },
});

export default CsvUploader;