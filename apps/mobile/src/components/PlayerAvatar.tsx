import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAvatarBgOption, getAvatarOption } from '../constants/avatars';
import { COLORS, SHADOWS } from '../theme/tokens';

interface PlayerAvatarProps {
  avatarId?: string | null;
  bgId?: string | null;
  fallbackName?: string;
  size?: number;
  ringColor?: string;
  ringWidth?: number;
  showEditBadge?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function PlayerAvatar({
  avatarId,
  bgId,
  fallbackName,
  size = 44,
  ringColor,
  ringWidth = 2,
  showEditBadge = false,
  onPress,
  accessibilityLabel = 'Cambiar avatar',
}: PlayerAvatarProps) {
  const avatar = getAvatarOption(avatarId, fallbackName);
  const bg = getAvatarBgOption(bgId, avatar);
  const borderColor = ringColor ?? bg.ringColor;
  const badgeSize = Math.max(18, Math.round(size * 0.34));
  const innerSize = size - ringWidth * 2;

  const content = (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: ringWidth,
            borderColor,
            backgroundColor: bg.bgColor,
          },
        ]}
      >
        <Image
          source={avatar.source}
          style={{
            width: innerSize,
            height: innerSize,
          }}
          resizeMode="cover"
        />
      </View>

      {showEditBadge && (
        <View
          style={[
            styles.editBadge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
            },
          ]}
        >
          <Ionicons
            name="pencil"
            size={Math.max(10, Math.round(badgeSize * 0.54))}
            color={COLORS.white}
          />
        </View>
      )}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
    ...SHADOWS.sm,
  },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: COLORS.indigo,
    borderWidth: 2,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
});
