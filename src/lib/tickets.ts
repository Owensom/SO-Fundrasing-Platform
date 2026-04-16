import type { TicketRef } from "../types/raffles";

export function ticketKey(ticket: TicketRef) {
  return `${ticket.colour}__${ticket.number}`;
}

export function makeTicket(colour: string, number: number): TicketRef {
  return { colour, number };
}

export function ticketsEqual(a: TicketRef, b: TicketRef) {
  return a.colour === b.colour && a.number === b.number;
}

export function hasTicket(list: TicketRef[], ticket: TicketRef) {
  return list.some((item) => ticketsEqual(item, ticket));
}

export function removeTicket(list: TicketRef[], ticket: TicketRef) {
  return list.filter((item) => !ticketsEqual(item, ticket));
}

export function sortTickets(list: TicketRef[]) {
  return [...list].sort((a, b) => {
    if (a.colour < b.colour) return -1;
    if (a.colour > b.colour) return 1;
    return a.number - b.number;
  });
}
