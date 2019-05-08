import React, { Component } from 'react';
import { View, InteractionManager } from 'react-native';
import ArrayUtils from 'utilities/ArrayUtils';

export default class MultiTouchComponent extends Component {

  constructor(props) {
    super(props);

    this.onStartShouldSetResponder = this.onStartShouldSetResponder.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);

    this.state = {
      loaded: false,
      componentFrames: [],
      activeTouches: []
    };
  }

  componentDidMount() {
    if (!this.state.loaded) {
      InteractionManager.runAfterInteractions(() => {
        this.setState({ loaded: true });
      });
    }
  }

  onStartShouldSetResponder = event => {
    const touchCoordinates = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY
    };

    const touchedFrame = this.state.componentFrames.find(item => (
      this.isInsideFrame(touchCoordinates, item.frame)
    ));

    if (touchedFrame) {
      const location = touchedFrame.panHandler ? { origin: touchCoordinates } : {};
      this.addActiveTouch(touchedFrame, event.nativeEvent.identifier, location);
    }

    return false;
  };

  handlePan = (component, coordinates) => {
    const activeTouch = this.state.activeTouches.find(item => (
      item.component.key === component.key
    ));

    activeTouch?.component.panHandler({
      coordinates: {
        x0: activeTouch.origin.x,
        y0: activeTouch.origin.y,
        x: coordinates.x,
        y: coordinates.y,
        dx: coordinates.x - activeTouch.origin.x,
        dy: coordinates.y - activeTouch.origin.y
      }
    });
  };

  onTouchMove = event => {
    const movedCoordinates = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY
    };

    const movedInComponent = this.state.componentFrames.find(item => (
      this.isInsideFrame(movedCoordinates, item.frame)
    ));

    if (movedInComponent) {
      if (movedInComponent.panHandler) {
        this.handlePan(movedInComponent, movedCoordinates);
      }

      return;
    }

    const cancelledTouch = this.state.activeTouches.find(item => (
      ArrayUtils.none(event.nativeEvent.touches.map(touch => {
        const touchLocation = {
          x: touch.pageX,
          y: touch.pageY
        };

        return this.isInsideFrame(touchLocation, item.component.frame);
      }))
    ));

    if (cancelledTouch && !cancelledTouch.component.panHandler) {
      cancelledTouch.component.handler({ isActive: false });
      this.setState({
        activeTouches: this.state.activeTouches.filter(touch => (
          touch.component !== cancelledTouch.component
        ))
      });
    }
  };

  onTouchEnd = event => {
    const touchCount = event.nativeEvent.touches.length;
    if (!touchCount) {
      this.emptyTouches();
    }

    const releasedCoordinates = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY
    };

    const releasedComponent = this.state.componentFrames.find(item => (
      this.isInsideFrame(releasedCoordinates, item.frame)
    ));

    if (releasedComponent) {
      releasedComponent.handler({ isActive: false });
      this.setState({
        activeTouches: this.state.activeTouches.filter(touch => (
          touch.component !== releasedComponent
        ))
      }, () => {
        if (touchCount < 1) {
          this.emptyTouches();
        }
      });
    }
  };

  addActiveTouch = (touchedComponent, eventId, location) => {
    touchedComponent.handler({ isActive: true });
    this.setState({
      activeTouches: [
        ...this.state.activeTouches,
        { 
          ...location,
          id: eventId,
          component: touchedComponent
        }
      ]
    });
  };

  emptyTouches = () => {
    const remainingTouches = [...this.state.activeTouches];
    this.setState({
      activeTouches: []
    });

    remainingTouches.forEach(touch => touch.component.handler({ isActive: false }));
  };

  isInsideFrame = (touch, frame) => ArrayUtils.all([
    touch.x >= frame.x,
    touch.y >= frame.y,
    touch.x < frame.x + frame.width,
    touch.y < frame.y + frame.height
  ]);

  addTouchable = (key, childProps) => {
    this[key].measure((_fx, _fy, width, height, px, py) => {
      const frameAlreadyAdded = this.state.componentFrames.find(item => (
        item.key === key
      ));

      if (!frameAlreadyAdded) {
        this.setState({
          componentFrames: [
            ...this.state.componentFrames,
            {
              key: key,
              frame: { x: px, y: py, width: width, height: height },
              handler: childProps.onMultiTouch,
              panHandler: childProps.onMultiPan
            }
          ]
        });
      }
    });
  };

  cloneChild = (key, child, childrenProps) => React.cloneElement(child, {
    ...childrenProps,
    ...(child.props.onMultiTouch
      ? {
        ref: view => { 
          child.ref && child.ref(view);
          this[key] = view;
        },
        onLayout: () => {
          this.addTouchable(key, child.props);
        }
      }
      : {}),
    key: child.props.key || key
  });

  mapChildren = (children, callback) => children.map(child => {
    if (!React.isValidElement(child)) {
      return child;
    }

    const childrenProps = {};
    if (child.props.children) {
      const childrenValue = Array.isArray(child.props.children)
        ? child.props.children
        : [child.props.children];

      childrenProps.children = this.mapChildren(childrenValue, callback);
    }

    return callback(child, childrenProps);
  });

  render() {
    let childIndex = 0;
    return (
      <View
        {...this.props}
        onStartShouldSetResponder={this.onStartShouldSetResponder}
        onTouchMove={this.onTouchMove}
        onTouchEnd={this.onTouchEnd}
      >
        {this.state.loaded && this.mapChildren(this.props.children, 
          (child, childrenProps) => {
            if (!child.props.onMultiTouch && !childrenProps.children) {
              return child;
            }

            const key = `touchable-${childIndex++}`;
            return this.cloneChild(key, child, childrenProps);
          })
        }
      </View>
    );
  }
}