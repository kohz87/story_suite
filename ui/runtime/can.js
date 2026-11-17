// Whether a control that sends command `type` should be drawn: false only when the port says it has nobody to answer that command (the live port; the fake port answers true).

/** `owner` is a ctx with a `port`, or a port. */
export const can = (owner, type) => {
  const port = typeof owner?.can === 'function' ? owner : owner?.port;
  return typeof port?.can !== 'function' || port.can(type) !== false;
};
