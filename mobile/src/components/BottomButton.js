import React, { Component } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';

export default class BottomButton extends Component {
  constructor(props) {
    super(props);
    this.state = {
    };
  }

  render() {
    return (
        <TouchableOpacity onPress={this.props.onPressFunction} style={styles.bottomButton}>
        <View>
          <Text style={styles.bottomButtonText}>{this.props.buttonText}</Text>
          {this.props.children}
        </View>
      </TouchableOpacity>
    );
  }
}

const styles = StyleSheet.create({
    bottomButton: {
        backgroundColor: 'black',
        marginTop: 'auto',
        margin: 20,
        padding: 15,
        paddingLeft: 30,
        paddingRight: 30,
        alignSelf: 'center'
      },
      bottomButtonText: {
        color: 'white',
        fontSize: 20
      }
})