from collections import Counter

from pydantic import BaseModel, model_validator


class Card(BaseModel):
    id: str
    title: str
    details: str


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class Board(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]

    @model_validator(mode="after")
    def check_consistency(self) -> "Board":
        placed = Counter(
            card_id for column in self.columns for card_id in column.cardIds
        )
        if set(placed) != set(self.cards) or any(n != 1 for n in placed.values()):
            raise ValueError("every card must appear in exactly one column")
        for key, card in self.cards.items():
            if key != card.id:
                raise ValueError(f"card key {key!r} does not match card id {card.id!r}")
        return self
