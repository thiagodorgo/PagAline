export enum ImpactStyle {
  Light = 'LIGHT',
  Medium = 'MEDIUM',
  Heavy = 'HEAVY',
}

export const Haptics = {
  async impact(_options: { style: ImpactStyle }): Promise<void> {
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }
  },
};
