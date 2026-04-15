import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, Button, Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { useState } from 'react';

export default function DB() {
    const db = SQLite.openDatabaseAsync('example.db'); //initialise db.
    const [isLoading, setIsLoading] = useState(flase);
    const [names, setNames] = useState([]);
    const [currentName, setCurrentName] = useState(undefined);

    useEffect(() => { //run at start of app, check and create db if not exists.
        db.transaction(tx => {
            tx.executeSql('CREATE TABLE IF NOT EXISTS category (cid INTEGER PRIMARY KEY AUTOINCREMENT, cname VARCHAR(255), description VARCHAR(255))'),
            tx.executeSql('CREATE TABLE IF NOT EXISTS recipient (rid INTEGER PRIMARY KEY AUTOINCREMENT, name VARCHAR(255), cid INT)'),
            tx.executeSql('CREATE TABLE IF NOT EXISTS record (tid INTEGER PRIMARY KEY AUTOINCREMENT, amount FLOAT, cid INT, date DATE, type VARCHAR(255), currency VARCHAR(255), inputdatetime DATETIME, description VARCHAR(255), rid int)')
        });

        db.transaction(tx => {
            tx.executeSql('SELECT * FROM ', null ,
                (txObj, resultSet) => setNames(resultSet.rows._array),
                (txObj, error) => console.log(error)
        );
        });

        setIsLoading(false);

    }, []);

    if(isLoading){
        return(
            <view>
                <text>Loading</text>
            </view>
        )
    };






    return(
        <view>
            <TextInput value={currentName} placeholder='name' onChangeText={setCurrentName} />
            <Text>test</Text>
        </view>
    );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    margin: 8
  }
});