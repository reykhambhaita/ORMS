import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import authService from '../../screens/authService';


const SPRING_CONFIG = {
  damping: 18,
  stiffness: 300, // Even snappier for better response
  mass: 0.8,      // Lighter feel
};

const TabPill = ({ tab, isActive, isLeftOfInactive, isRightOfInactive, onTabPress, isDark, userAvatar }) => {
  const animatedWidth = useDerivedValue(() => {
    return withSpring(isActive ? 180 : 70, SPRING_CONFIG);
  });

  const animatedStyle = useAnimatedStyle(() => {
    // Determine the margin to close the gap when items merge.
    // The base gap is 12px. To merge, we need to negate 13px (gap + overlap).
    return {
      width: animatedWidth.value,
      borderTopRightRadius: withSpring(isLeftOfInactive ? 0 : 28, SPRING_CONFIG),
      borderBottomRightRadius: withSpring(isLeftOfInactive ? 0 : 28, SPRING_CONFIG),
      borderTopLeftRadius: withSpring(isRightOfInactive ? 0 : 28, SPRING_CONFIG),
      borderBottomLeftRadius: withSpring(isRightOfInactive ? 0 : 28, SPRING_CONFIG),
      marginRight: withSpring(isLeftOfInactive ? -1 : 12, SPRING_CONFIG),
    };
  });

  const labelStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isActive ? 1 : 0, { duration: 150 }),
    transform: [{ scale: withSpring(isActive ? 1 : 0.7, SPRING_CONFIG) }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isActive ? 1.1 : 1, SPRING_CONFIG) }],
  }));

  return (
    <TouchableOpacity
      onPress={onTabPress}
      activeOpacity={0.9}
    >
      <Animated.View style={[styles.pill, animatedStyle, { backgroundColor: isDark ? '#FFFFFF' : '#111111' }]}>
        <Animated.View style={iconStyle}>
          {tab.id === 'Profile' && userAvatar ? (
            <Image
              source={{ uri: userAvatar }}
              style={[
                styles.avatarIcon,
                { borderColor: isDark ? '#000000' : '#FFFFFF' }
              ]}
            />
          ) : (
            <Ionicons
              name={isActive ? tab.icon : `${tab.icon}-outline`}
              size={22}
              color={isDark ? '#000000' : '#FFFFFF'}
            />
          )}
        </Animated.View>
        {isActive && (
          <Animated.View style={[styles.labelWrapper, labelStyle]}>
            <Text style={[styles.tabLabel, { color: isDark ? '#000000' : '#FFFFFF' }]} numberOfLines={1}>{tab.label}</Text>
          </Animated.View>
        )}
      </Animated.View>
    </TouchableOpacity>

  );
};

const CustomBottomNavigation = ({ activeTab, onTabPress }) => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [userAvatar, setUserAvatar] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const user = await authService.getUser();
      if (user && user.avatar) {
        setUserAvatar(user.avatar);
      }
    };
    fetchUser();
  }, [activeTab]); // Refresh on tab change as they might have updated profile

  const tabs = [
    { id: 'Home', icon: 'home', label: 'Home' },
    { id: 'Search', icon: 'search', label: 'Search' },
    { id: 'Profile', icon: 'person', label: 'Profile' }
  ];

  return (
    <View style={[
      styles.container,
      {
        paddingBottom: Math.max(insets.bottom, 12),
        backgroundColor: isDark ? '#000000' : '#FFFFFF',
        borderTopColor: isDark ? '#222222' : '#f5f5f5'
      }
    ]}>
      <View style={styles.navBar}>
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTab;
          const prevTab = tabs[index - 1];
          const nextTab = tabs[index + 1];

          const isLeftOfInactive = !isActive && nextTab && nextTab.id !== activeTab;
          const isRightOfInactive = !isActive && prevTab && prevTab.id !== activeTab;

          return (
            <TabPill
              key={tab.id}
              tab={tab}
              isActive={isActive}
              isLeftOfInactive={isLeftOfInactive}
              isRightOfInactive={isRightOfInactive}
              onTabPress={() => onTabPress(tab.id)}
              isDark={isDark}
              userAvatar={userAvatar}
            />
          );
        })}
      </View>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingBottom: 12,
    paddingTop: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 25,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // We remove the gap and handle all spacing via marginRight in TabPill for perfectly smooth joins
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    backgroundColor: '#111111',
    overflow: 'hidden',
  },
  labelWrapper: {
    marginLeft: 10,
    maxWidth: 80,
  },
  tabLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  avatarIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
});


export default CustomBottomNavigation;
