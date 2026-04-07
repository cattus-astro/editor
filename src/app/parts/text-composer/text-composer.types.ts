export interface UpdateTextEvent {
  text: string;
  // TODO: 이렇게 디테일할 필요가 있을까? 한번 추상화하는게 좋을수도 있을듯...!
  eventType: 'compositionstart' | 'compositionupdate' | 'compositionend' | 'input';
}
