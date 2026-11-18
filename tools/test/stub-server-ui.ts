/** Enough of @minecraft/server-ui for modules that import it to load. */
export class ActionFormData {
  title() { return this; }
  body() { return this; }
  button() { return this; }
  show() { return Promise.resolve({ canceled: true }); }
}

export class ModalFormData {
  title() { return this; }
  textField() { return this; }
  toggle() { return this; }
  dropdown() { return this; }
  slider() { return this; }
  show() { return Promise.resolve({ canceled: true }); }
}

export class MessageFormData {
  title() { return this; }
  body() { return this; }
  button1() { return this; }
  button2() { return this; }
  show() { return Promise.resolve({ canceled: true }); }
}
