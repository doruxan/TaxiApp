import React, { Component } from 'react';
import { Alert, Button, Image, Keyboard, View, Text, TextInput, StyleSheet, TouchableHighlight, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps'
import Permissions from 'react-native-permissions'
import { API_KEY } from '../../constants'
import Geolocation from '@react-native-community/geolocation';
import _ from 'lodash'
import PolyLine from '@mapbox/polyline'
import socketIO from 'socket.io-client'
import BottomButton from '../components/BottomButton';

export default class Passenger extends Component {
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
      destination: '',
      predictions: [],
      pointCoords: [],
      routeResponse: {},
      lookingForDriver: false,
      driverIsOnTheWay: false,

    }
    this.fetchUrlDebounced = _.debounce(this.fetchUrl, 500)

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
  }

  componentWillUnmount(){
    Geolocation.clearWatch(this.watchId)
  }

  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      this.watchId = Geolocation.watchPosition(
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


  async getRouteDirections(destinationPlaceId, destinationName) {
    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?origin=${this.state.region.latitude},${this.state.region.longitude}&destination=place_id:${destinationPlaceId}&key=${API_KEY}`)
      const json = await response.json()
      const points = PolyLine.decode(json.routes[0].overview_polyline.points)
      const pointCoords = points.map(point => {
        return { latitude: point[0], longitude: point[1] }
      })
      this.setState({
        pointCoords,
        predictions: [],
        destination: destinationName,
        routeResponse: json
      })
      Keyboard.dismiss()
      this.map.fitToCoordinates(pointCoords, { edgePadding: { top: 20, bottom: 20, left: 20, right: 20 } })
    } catch (error) {
      console.log(error)
    }
  }


  async onCahngeDestination(destination) {
    this.setState({ destination })
    const { latitude, longitude } = this.state.region
    const apiUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?key=${API_KEY}&input=${destination}&location=${latitude},${longitude}&radius=2000`

    await this.fetchUrlDebounced(apiUrl)
  }

  async fetchUrl(apiUrl) {
    try {
      const result = await fetch(apiUrl)
      const json = await result.json()
      this.setState({
        predictions: json.predictions
      })
    } catch (error) {
      console.log(error)
    }
  }

  async requestDriver() {
    this.setState({ lookingForDriver: true });
    var socket = socketIO.connect("http://192.168.0.11:3000");

    socket.on("connect", () => {
      console.log("client connected");
      //Request a taxi!
      socket.emit("taxiRequest", this.state.routeResponse);
    });

    socket.on("driverLocation", driverLocation => {
      const pointCoords = [...this.state.pointCoords, driverLocation];
      this.map.fitToCoordinates(pointCoords, {
        edgePadding: { top: 50, bottom: 50, left: 20, right: 20 }
      });
      this.setState({
        lookingForDriver: false,
        driverIsOnTheWay: true,
        driverLocation
      });
    });
  }


  render() {
    let marker = null
    let getDriver = null;
    let findingDriverActIndicator = null;
    let driverMarker = null;

    if (this.state.driverIsOnTheWay) {
      driverMarker = (
        <Marker coordinate={this.state.driverLocation}>
           <Image
            style={{ width: 20, height: 20 }}
            source={require("../images/carIcon.png")}
          />
        </Marker>
      );
    }

    if (this.state.lookingForDriver) {
      findingDriverActIndicator = (
        <ActivityIndicator
          size="large"
          animating={this.state.lookingForDriver}
        />
      );
    }

    if (this.state.pointCoords.length > 1) {
      marker = (
        <Marker coordinate={this.state.pointCoords[this.state.pointCoords.length - 1]} />
      )
      getDriver = (
        <BottomButton
        onPressFunction={() => this.requestDriver()}
        buttonText="REQUEST 🚗"
        >
          {findingDriverActIndicator}
        </BottomButton>
      )
    }

    const predictions = this.state.predictions.map(prediction =>
      <TouchableHighlight onPress={() => this.getRouteDirections(prediction.place_id, prediction.structured_formatting.main_text)} key={prediction.id}>
        <View>
          <Text style={styles.suggestions} >{prediction.structured_formatting.main_text}</Text>
        </View>
      </TouchableHighlight>
    )

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
            strokeColor={'blue'}
          />
          {marker}
          {driverMarker}
        </MapView>

        <TextInput
          placeholder={'Enter destination.'}
          value={this.state.destination}
          onChangeText={destination =>{
            this.setState({ destination, pointCoords: [] })
            this.onCahngeDestination(destination)
          }}
          style={styles.inputStyle}
        />

        {predictions}
        {getDriver}

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
});