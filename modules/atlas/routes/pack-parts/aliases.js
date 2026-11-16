// Mode aliases and mode-group lists for pre-modern and modern travel.

export const MODERN_ALIASES = {
    walk: 'foot', walking: 'foot', walks: 'foot', hike: 'foot', hiking: 'foot', 'on foot': 'foot',
    bicycle: 'bike', cycle: 'bike', cycling: 'bike', biking: 'bike', bikes: 'bike',
    drive: 'car', driving: 'car', drives: 'car', cars: 'car', taxi: 'car', cab: 'car', van: 'car', truck: 'car',
    motorcycle: 'motorbike', scooter: 'motorbike', moped: 'motorbike',
    coach: 'bus', buses: 'bus',
    rail: 'train', trains: 'train',
    subway: 'metro', underground: 'metro', tube: 'metro', tram: 'metro',
    boat: 'ferry', ferries: 'ferry',
    ships: 'ship', cruise: 'ship',
    fly: 'plane', flying: 'plane', flies: 'plane', flight: 'plane', planes: 'plane', airplane: 'plane', aeroplane: 'plane', jet: 'plane',
};

// Words the model writes for a mode.
export const MODE_ALIASES = {
    walk: 'foot', walking: 'foot', walks: 'foot', hike: 'foot', hiking: 'foot',
    rides: 'ride', riding: 'ride', rider: 'ride', riders: 'ride', horse: 'ride', horseback: 'ride', mounted: 'ride',
    wagons: 'wagon', cart: 'wagon', carts: 'wagon', dray: 'wagon',
    boats: 'boat', barge: 'boat', ferry: 'boat', riverboat: 'boat', keelboat: 'boat',
    ships: 'ship', sail: 'ship', sailing: 'ship',
    fly: 'flight', flying: 'flight', flies: 'flight',
    couriers: 'courier', messenger: 'courier',
};

export const LAND_MODES = ['foot', 'ride', 'wagon'];
export const WATER_MODES = ['boat', 'ship'];
