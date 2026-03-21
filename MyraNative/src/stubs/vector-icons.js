/**
 * Temporary stub for @expo/vector-icons
 * Aliased via metro.config.js resolveRequest to prevent expo-font/expo-asset from being pulled in.
 * Icons render as invisible placeholder text.
 * TODO: Replace with react-native-vector-icons once fonts are properly linked.
 */
import React from 'react';
import {Text} from 'react-native';

const makeIcon = () =>
  function IconStub({size = 24, color = '#000', style}) {
    return React.createElement(Text, {style: [{fontSize: size, color}, style]}, '');
  };

export const Ionicons = makeIcon();
export const MaterialIcons = makeIcon();
export const FontAwesome = makeIcon();
export const Feather = makeIcon();
export const AntDesign = makeIcon();
export const Entypo = makeIcon();
export const MaterialCommunityIcons = makeIcon();
