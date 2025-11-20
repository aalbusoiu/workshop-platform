let counter = 1;

export const nextId = (): number => counter++;

export const resetFactoryIds = (): void => {
  counter = 1;
};