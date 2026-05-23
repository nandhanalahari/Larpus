import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

type IconName = keyof typeof MaterialIcons.glyphMap;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  filled?: boolean;
};

export function CipherIcon({
  name,
  size = 24,
  color = theme.colors.primary,
  filled = false,
}: Props) {
  return <MaterialIcons name={name} size={size} color={color} />;
}
