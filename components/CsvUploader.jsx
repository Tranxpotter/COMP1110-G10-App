import React, { useState } from 'react';
import { View, Button, Text, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useCsvImport } from '../hooks/useCsvImport';

const CsvUploader = () => {
    const [fileName, setFileName] = useState('');
    const { importCsv } = useCsvImport();

    const handleFileUpload = async () => {
        const result = await DocumentPicker.getDocumentAsync({
            type: 'text/csv',
        });

        if (result.type === 'success') {
            setFileName(result.name);
            await importCsv(result.uri);
        } else {
            console.log('File upload canceled or failed');
        }
    };

    return (//reusable, this ui component will give u chance to upload folder
        <View style={styles.container}>
            <Button title="Upload CSV" onPress={handleFileUpload} />
            {fileName ? <Text style={styles.fileName}>Uploaded: {fileName}</Text> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    fileName: {
        marginTop: 16,
        fontSize: 16,
    },
});

export default CsvUploader;