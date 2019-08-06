import React, { Component } from 'react';
import { ActivityIndicator, Image, Linking, View, Platform, StyleSheet, } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps'
import Permissions from 'react-native-permissions'
import { API_KEY } from '../../constants'
import Geolocation from '@react-native-community/geolocation';
import BackgroundGeolocation from '@mauron85/react-native-background-geolocation';

import _ from 'lodash'
import PolyLine from '@mapbox/polyline'
import socketIO from 'socket.io-client'
import BottomButton from '../components/BottomButton';

export default class Driver extends Component {
  constructor(props) {
    super(props)
    this.state = {
      region: {
        latitude: 41.0087,
        longitude: 29.0173,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421
      },
      error: '',
      pointCoords: [],
      lookingForPassengers: false,
      bottomText: 'FIND PASSENGER'
    }
    this.lookForPassengers = this.lookForPassengers.bind(this);
    this.acceptPassengerRequest = this.acceptPassengerRequest.bind(this)
    this.socket = null;
  }

  async componentDidMount() {
    Permissions
      .request('location')
      .then(async response => {
        try {
          const { coords: { latitude, longitude } } = await this.getCurrentPosition()
          // this.setState({
          //   region: {
          //     ...this.state.region,
          //     latitude,
          //     longitude
          //   },
          // })
          await this.getRouteDirections()

        } catch (e) {
          alert('Can not read location info.')
        }
      })

      BackgroundGeolocation.configure({
        desiredAccuracy: BackgroundGeolocation.HIGH_ACCURACY,
        stationaryRadius: 50,
        distanceFilter: 50,
        debug: false,
        startOnBoot: false,
        stopOnTerminate: true,
        locationProvider: BackgroundGeolocation.ACTIVITY_PROVIDER,
        interval: 10000,
        fastestInterval: 5000,
        activitiesInterval: 10000,
        stopOnStillActivity: false,
      });

      BackgroundGeolocation.on('authorization', (status) => {
        console.log('[INFO] BackgroundGeolocation authorization status: ' + status);
        if (status !== BackgroundGeolocation.AUTHORIZED) {
          // we need to set delay or otherwise alert may not be shown
          setTimeout(() =>
            Alert.alert('App requires location tracking permission', 'Would you like to open app settings?', [
              { text: 'Yes', onPress: () => BackgroundGeolocation.showAppSettings() },
              { text: 'No', onPress: () => console.log('No Pressed'), style: 'cancel' }
            ]), 1000);
        }
      });
  }

  componentWillUnmount(){
    Geolocation.clearWatch(this.watchId)
  }

  async getCurrentPosition() {
    return new Promise((resolve, reject) => {
      this.watchId =  Geolocation.watchPosition(
        position => {
          // resolve(position)
          this.setState({
            region: {
              ...this.state.region,
              latitude:position.coords.latitude,
              longitude:position.coords.longitude
            },
          })
        },
        () => { reject() },
        {
          enableHighAccuracy: true, 
          timeout: 20000, 
          maximumAge: 0, 
          distanceFilter: 1
        }
      )
    })
  }

  async getRouteDirections(destinationPlaceId) {
    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${this.state.region.latitude},${this.state.region.longitude}&destination=place_id:${destinationPlaceId}&key=${API_KEY}`)
      const json = await response.json()
      const points = PolyLine.decode(json.routes[0].overview_polyline.points)
      const pointCoords = points.map(point => {
        return { latitude: point[0], longitude: point[1] }
      })
      this.setState({ pointCoords, predictions: [] })
      this.map.fitToCoordinates(pointCoords, { edgePadding: { top: 20, bottom: 20, left: 20, right: 20 } })
    } catch (error) {
      console.log(error)
    }
  }

  lookForPassengers() {
    if (!this.state.lookingForPassengers) {
      this.setState({ lookingForPassengers: true })
      this.socket = socketIO.connect('http://192.168.0.11:3000')

      this.socket.on("connect", () => {
        this.socket.emit("passengerRequest");
      });

      this.socket.on('taxiRequest', (routeResponse) => {
        this.getRouteDirections(routeResponse.geocoded_waypoints[0].place_id)
        this.setState({ lookingForPassengers: false, passengerFound: true, routeResponse })

      })
    }
  }

  acceptPassengerRequest() {
    const { latitude, longitude } = this.state.region

    const passengerLocation = this.state.pointCoords[this.state.pointCoords.length - 1]

    BackgroundGeolocation.on('location', (location) => {
      //send driver location to passenger
      this.socket.emit('driverLocation', { 
        latitude : location.latitude, 
        longitude : location.longitude 
      })
    });

    BackgroundGeolocation.checkStatus(status => {
      // you don't need to check status before start (this is just the example)
      if (!status.isRunning) {
        BackgroundGeolocation.start(); //triggers start on start event
      }
    });


    if (Platform.OS === 'ios') {
      Linking.openURL(`http://maps.apple.com/?daddr=${passengerLocation.latitude},${passengerLocation.longitude}`)
    } else {
      Linking.openURL(`google.navigation:q=${passengerLocation.latitude}+${passengerLocation.longitude}`)
      //Linking.openURL(`http://www.google.com/dir/?api=1&destination=${passengerLocation.latitude},${passengerLocation.longitude}`)
    }
  }

  render() {
    let endMarker = null;
    let startMarker = null;
    let findingPassengerActIndicator = null;
    let passengerSearchText = "FIND PASSENGERS";
    let bottomButtonFunction = this.lookForPassengers

    if (this.state.lookingForPassengers) {
      passengerSearchText = "FINDING PASSENGERS...";
      findingPassengerActIndicator = (
        <ActivityIndicator
          size="large"
          animating={this.state.lookingForPassengers}
        />
      );
    }

    if (this.state.passengerFound) {
      passengerSearchText = "FOUND PASSENGER! ACCEPT RIDE?";
      bottomButtonFunction = this.acceptPassengerRequest
    }


    if (this.state.pointCoords.length > 1) {
      endMarker = (
        <Marker coordinate={this.state.pointCoords[this.state.pointCoords.length - 1]}>
          <Image
            style={{ width: 40, height: 40 }}
            source={require("../images/person-marker.png")}
          />
        </Marker>
      )
    }

    return (
      <View style={styles.container}>

        <MapView
          ref={map => { this.map = map }}
          style={styles.map}
          initialRegion={{
            latitude: this.state.region.latitude,
            longitude: this.state.region.longitude,
            latitudeDelta: this.state.region.latitudeDelta,
            longitudeDelta: this.state.region.longitudeDelta,
          }}
          showsUserLocation={true}
        >
          <Polyline
            coordinates={this.state.pointCoords}
            strokeWidth={4}
            strokeColor={'aquamarine'}
          />
          {endMarker}
          {startMarker}
        </MapView>

        <BottomButton
          onPressFunction={bottomButtonFunction}
          buttonText={passengerSearchText}
        >
          {findingPassengerActIndicator}
        </BottomButton>

      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    flex: 1
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    flex: 1
  },
  inputStyle: {
    height: 40,
    borderWidth: 0.5,
    marginTop: 30,
    marginRight: 5,
    marginLeft: 5,
    padding: 5,
    backgroundColor: 'white'
  },
  suggestions: {
    backgroundColor: 'white',
    padding: 5,
    fontSize: 18,
    borderWidth: 0.5,
    marginRight: 5,
    marginLeft: 5
  },

});