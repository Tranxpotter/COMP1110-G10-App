import React, { useState } from 'react';
import { View, Button, Text, StyleSheet, Alert, Modal } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Papa from 'papaparse';
import { useCsvImport } from '../hooks/useCsvImport';

const CsvUploader = () => {
  const [fileName, setFileName] = useState('');
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressValue, setProgressValue] = useState(0);
  const [progressLabel, setProgressLabel] = useState('Preparing import...');
  const { importCsv } = useCsvImport();

  function updateProgress(value, label) {
    const normalized = Math.max(0, Math.min(1, Number(value) || 0));
    setProgressValue(normalized);
    if (label) {
      setProgressLabel(label);
    }
  }

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
      setShowProgressModal(true);
      updateProgress(0.05, `Preparing ${name}...`);

      // Attempt multiple read strategies, including blob/text, File API if present, fallback to FileSystem
      let text = null;

      // 1) fetch + text()
      updateProgress(0.15, 'Reading file...');
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
        if (text) {
          updateProgress(0.35, 'File loaded.');
        }
      } catch (e) {
        console.warn('fetch(uri) failed or res.text() unavailable', e);
      }

      // 2) try FileSystem read
      if (!text) {
        try {
          text = await readString(uri);
          if (text) {
            updateProgress(0.35, 'File loaded.');
          }
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
          if (text) {
            updateProgress(0.35, 'File loaded.');
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
          if (text) {
            updateProgress(0.35, 'File loaded.');
          }
        } catch (e) {
          console.warn('saveToCache/read fallback failed', e);
        }
      }

      if (!text) {
        Alert.alert('File access error', 'Could not read the selected file. See console.');
        return;
      }

      // parse CSV (header autodetect)
      updateProgress(0.5, 'Parsing CSV...');
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      if (parsed.errors && parsed.errors.length) {
        console.warn('CSV parse errors', parsed.errors);
        Alert.alert('CSV parse warning', String(parsed.errors[0].message || parsed.errors[0]));
        // continue to import attempt even if warnings present
      }

      // try import hook
      updateProgress(0.55, 'Importing records...');
      let importResult = { inserted: 0, skipped: 0, total: 0 };
      try {
        importResult = await importCsv(parsed.data, {
          onProgress: ({ completed, total, progress }) => {
            const safeProgress = Number.isFinite(progress)
              ? progress
              : (Number(total) > 0 ? Number(completed) / Number(total) : 1);
            const mappedProgress = 0.55 + Math.max(0, Math.min(1, safeProgress || 0)) * 0.45;
            const progressText = Number(total) > 0
              ? `Importing records... ${completed}/${total}`
              : 'Importing records...';
            updateProgress(mappedProgress, progressText);
          },
        });
      } catch (e) {
        console.error('importCsv failed', e);
        Alert.alert('Import failed', 'CSV import failed. See console.');
        return;
      }

      updateProgress(1, 'Import complete.');
      Alert.alert('Import Complete', `${importResult.inserted} inserted, ${importResult.skipped} skipped`);
    } catch (err) {
      console.error('DocumentPicker error', err);
      Alert.alert('Error', String(err));
    } finally {
      setShowProgressModal(false);
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Upload CSV" onPress={handleFileUpload} />

      <Modal
        visible={showProgressModal}
        transparent={true}
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Uploading CSV</Text>
            {!!fileName && <Text style={styles.modalFileName}>{fileName}</Text>}
            <Text style={styles.modalStatus}>{progressLabel}</Text>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progressValue * 100)}%` }]} />
            </View>

            <Text style={styles.progressPercent}>{Math.round(progressValue * 100)}%</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  fileName: { marginTop: 12, fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalFileName: {
    fontSize: 13,
    color: '#555',
    marginBottom: 8,
  },
  modalStatus: {
    fontSize: 14,
    marginBottom: 12,
  },
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#e1e5ea',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0BA5A4',
  },
  progressPercent: {
    marginTop: 10,
    textAlign: 'right',
    fontWeight: '700',
    color: '#0B7285',
  },
});

export default CsvUploader;