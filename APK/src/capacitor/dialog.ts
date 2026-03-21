export const Dialog = {
  async confirm(options: { title: string; message: string }): Promise<{ value: boolean }> {
    const value = window.confirm(`${options.title}\n\n${options.message}`);
    return { value };
  },
};
