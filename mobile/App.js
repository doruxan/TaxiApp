import React, { Component } from 'react';
import {StyleSheet, Button, View} from 'react-native';
import Driver from './src/screens/Driver'
import Passenger from './src/screens/Passenger'

export default class App extends Component {
  constructor(props) {
    super(props)
    this.state = {
      isDriver:false,
      isPassenger:false
    }
  }

  render() {
    if(this.state.isDriver){
      return <Driver/>
    }

    if(this.state.isPassenger){
      return <Passenger/>
    }
    return (
      <View style={styles.container}>
        <Button onPress={() => this.setState({isPassenger:true})} title='Passenger' />
        <Button onPress={() => this.setState({isDriver:true})} title='Driver' />

      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    marginTop:50
  },
  button:{
    margin:5
  }
});