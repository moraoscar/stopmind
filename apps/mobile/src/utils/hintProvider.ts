import { normalizeWord } from '@stopmind/shared';
import { fetchHintViaBackend } from './apiValidator';

// Built-in offline Spanish STOP! hint dictionary (works 100% on local WiFi without internet)
type CategoryHints = Record<string, string[]>;

const DICT: Record<string, CategoryHints> = {
  nombre: {
    a: ['Alejandro', 'Andrea', 'Andres', 'Adriana'],
    b: ['Beatriz', 'Bruno', 'Belen', 'Benjamin'],
    c: ['Camila', 'Carlos', 'Carolina', 'Cristian'],
    d: ['Daniel', 'Diana', 'Diego', 'Daniela'],
    e: ['Eduardo', 'Elena', 'Esteban', 'Emilia'],
    f: ['Felipe', 'Fernanda', 'Francisco', 'Fabian'],
    g: ['Gabriel', 'Gabriela', 'Gustavo', 'Gloria'],
    h: ['Hector', 'Helena', 'Hugo', 'Hernan'],
    i: ['Ignacio', 'Isabel', 'Ivan', 'Irene'],
    j: ['Javier', 'Jorge', 'Julia', 'Juliana'],
    l: ['Laura', 'Leonardo', 'Lucia', 'Luis'],
    m: ['Manuel', 'Maria', 'Mateo', 'Mariana'],
    n: ['Natalia', 'Nicolas', 'Nadia', 'Nestor'],
    o: ['Oscar', 'Olivia', 'Omar', 'Orlando'],
    p: ['Pablo', 'Patricia', 'Paula', 'Pedro'],
    q: ['Quintin', 'Quique', 'Quetzal'],
    r: ['Rafael', 'Raquel', 'Ricardo', 'Roberto'],
    s: ['Samuel', 'Santiago', 'Sofia', 'Sebastian'],
    t: ['Tatiana', 'Tomas', 'Teresa', 'Thiago'],
    u: ['Ulises', 'Ursula', 'Uriel'],
    v: ['Valentina', 'Valeria', 'Victor', 'Vicente'],
  },
  apellido: {
    a: ['Alvarez', 'Acosta', 'Aguilar', 'Arias'],
    b: ['Benitez', 'Blanco', 'Bravo', 'Bermudez'],
    c: ['Castillo', 'Castro', 'Cabrera', 'Cortes'],
    d: ['Delgado', 'Diaz', 'Dominguez', 'Duarte'],
    e: ['Escobar', 'Espinoza', 'Estrada', 'Echeverria'],
    f: ['Fernandez', 'Flores', 'Fuentes', 'Figueroa'],
    g: ['Garcia', 'Gomez', 'Gonzalez', 'Guerrero'],
    h: ['Hernandez', 'Herrera', 'Hidalgo', 'Hurtado'],
    i: ['Ibarra', 'Iglesias', 'Izquierdo', 'Infante'],
    j: ['Jimenez', 'Juarez', 'Jaramillo', 'Jurado'],
    l: ['Lopez', 'Leon', 'Lara', 'Lozano'],
    m: ['Martinez', 'Medina', 'Mendoza', 'Morales'],
    n: ['Navarro', 'Nunez', 'Nieto', 'Noguera'],
    o: ['Ortega', 'Ortiz', 'Ochoa', 'Osorio'],
    p: ['Perez', 'Paredes', 'Pena', 'Pardo'],
    q: ['Quintero', 'Quiroga', 'Quesada', 'Quevedo'],
    r: ['Ramirez', 'Reyes', 'Rojas', 'Romero'],
    s: ['Sanchez', 'Salazar', 'Silva', 'Suarez'],
    t: ['Torres', 'Tapia', 'Trujillo', 'Toledo'],
    u: ['Uribe', 'Ulloa', 'Urrutia', 'Ugalde'],
    v: ['Vargas', 'Vega', 'Valencia', 'Velasquez'],
  },
  animal: {
    a: ['Aguila', 'Ardilla', 'Abeja', 'Alce'],
    b: ['Ballena', 'Buho', 'Burro', 'Bufalo'],
    c: ['Caballo', 'Camello', 'Cocodrilo', 'Conejo'],
    d: ['Delfin', 'Dromedario', 'Dragon de Komodo'],
    e: ['Elefante', 'Erizo', 'Escarabajo', 'Estrella de mar'],
    f: ['Flamenco', 'Foca', 'Flamingo', 'Faisan'],
    g: ['Gato', 'Gorila', 'Guepardo', 'Gaviota'],
    h: ['Hipopotamo', 'Hormiga', 'Halcon', 'Hiena'],
    i: ['Iguana', 'Impala', 'Insecto palo'],
    j: ['Jirafa', 'Jaguar', 'Jabali', 'Jilguero'],
    l: ['Leon', 'Lobo', 'Leopardo', 'Loro'],
    m: ['Mono', 'Mariposa', 'Murcielago', 'Mapache'],
    n: ['Nutria', 'Narval', 'Nandu'],
    o: ['Oso', 'Oveja', 'Orca', 'Ornitorrinco'],
    p: ['Perro', 'Pinguino', 'Pantera', 'Pato'],
    q: ['Quetzal', 'Quirquincho', 'Quokka'],
    r: ['Raton', 'Rinoceronte', 'Rana', 'Reno'],
    s: ['Serpiente', 'Sapo', 'Suricata', 'Salmon'],
    t: ['Tigre', 'Tortuga', 'Tiburon', 'Tucan'],
    u: ['Urraca', 'Urogallo', 'Uakari'],
    v: ['Vaca', 'Venado', 'Vibora', 'Vicuna'],
  },
  cosa: {
    a: ['Almohada', 'Anillo', 'Armario', 'Antena'],
    b: ['Botella', 'Boligrafo', 'Bicicleta', 'Balde'],
    c: ['Cuaderno', 'Cuchara', 'Camisa', 'Candado'],
    d: ['Dado', 'Despertador', 'Destornillador', 'Disco'],
    e: ['Espejo', 'Escoba', 'Escritorio', 'Enchufe'],
    f: ['Foco', 'Flauta', 'Frazada', 'Florero'],
    g: ['Gafas', 'Guitarra', 'Guante', 'Grapadora'],
    h: ['Hacha', 'Hamaca', 'Horno', 'Hilo'],
    i: ['Iman', 'Impresora', 'Interruptor', 'Imperdible'],
    j: ['Jabon', 'Jarra', 'Juguete', 'Jaula'],
    l: ['Lampara', 'Lapiz', 'Libro', 'Llave'],
    m: ['Mesa', 'Mochila', 'Martillo', 'Maleta'],
    n: ['Navaja', 'Nevera', 'Notebook', 'Nudo'],
    o: ['Olla', 'Ordenador', 'Oboe', 'Organizador'],
    p: ['Puerta', 'Peine', 'Plato', 'Paraguas'],
    q: ['Quitasol', 'Quemador', 'Quena'],
    r: ['Reloj', 'Radio', 'Regla', 'Rueda'],
    s: ['Silla', 'Sombrero', 'Sarten', 'Sobre'],
    t: ['Telefono', 'Tijera', 'Taza', 'Teclado'],
    u: ['Uniforme', 'Urna', 'Utensilio', 'Ukelele'],
    v: ['Vaso', 'Vela', 'Ventilador', 'Violin'],
  },
  color: {
    a: ['Azul', 'Amarillo', 'Aguamarina', 'Ambar'],
    b: ['Blanco', 'Beige', 'Burdeos', 'Bronce'],
    c: ['Celeste', 'Cafe', 'Carmesi', 'Coral'],
    d: ['Dorado', 'Durazno', 'Denim'],
    e: ['Esmeralda', 'Escarlata', 'Ebano'],
    f: ['Fucsia', 'Frambuesa', 'Flamingo'],
    g: ['Gris', 'Granate', 'Guinda'],
    h: ['Hueso', 'Humo', 'Hielo'],
    i: ['Indigo', 'Ivory', 'Iris'],
    j: ['Jade', 'Jazmin', 'Jaspe'],
    l: ['Lila', 'Lavanda', 'Lima', 'Ladrillo'],
    m: ['Morado', 'Marron', 'Magenta', 'Mostaza'],
    n: ['Naranja', 'Negro', 'Nacar', 'Nuez'],
    o: ['Ocre', 'Oliva', 'Oro', 'Orquidea'],
    p: ['Plateado', 'Purpura', 'Perla', 'Pistacho'],
    q: ['Quermes', 'Quemado'],
    r: ['Rojo', 'Rosado', 'Rubi', 'Rosa'],
    s: ['Salmon', 'Sepia', 'Siena'],
    t: ['Turquesa', 'Terracota', 'Trigo'],
    u: ['Uva', 'Ultramar'],
    v: ['Verde', 'Violeta', 'Vino', 'Vainilla'],
  },
  lugar: {
    a: ['Argentina', 'Alemania', 'Atenas', 'Amazonas'],
    b: ['Brasil', 'Bogota', 'Barcelona', 'Bolivia'],
    c: ['Colombia', 'Canada', 'Caracas', 'Chile'],
    d: ['Dinamarca', 'Dublin', 'Dubai', 'Durango'],
    e: ['Espana', 'Ecuador', 'Egipto', 'Estocolmo'],
    f: ['Francia', 'Florencia', 'Finlandia', 'Filipinas'],
    g: ['Guatemala', 'Grecia', 'Guadalajara', 'Ginebra'],
    h: ['Honduras', 'Holanda', 'Hungria', 'Helsinki'],
    i: ['Italia', 'India', 'Irlanda', 'Islandia'],
    j: ['Japon', 'Jamaica', 'Jerusalen', 'Jordania'],
    l: ['Lima', 'Londres', 'Lisboa', 'Luxemburgo'],
    m: ['Mexico', 'Madrid', 'Medellin', 'Montevideo'],
    n: ['Noruega', 'Nicaragua', 'Napoles', 'Nueva York'],
    o: ['Oslo', 'Ottawa', 'Oaxaca', 'Oporto'],
    p: ['Peru', 'Paris', 'Panama', 'Portugal'],
    q: ['Quito', 'Quebec', 'Queretaro', 'Qatar'],
    r: ['Roma', 'Rusia', 'Rio de Janeiro', 'Rumania'],
    s: ['Suiza', 'Santiago', 'Sevilla', 'Suecia'],
    t: ['Tokio', 'Turquia', 'Toronto', 'Tailandia'],
    u: ['Uruguay', 'Ucrania', 'Ushuaia', 'Utah'],
    v: ['Venezuela', 'Valencia', 'Venecia', 'Viena'],
  },
  fruta: {
    a: ['Arandano', 'Aguacate', 'Albaricoque', 'Anana'],
    b: ['Banana', 'Breva', 'Bergamota', 'Baya'],
    c: ['Cereza', 'Ciruela', 'Coco', 'Chirimoya'],
    d: ['Durazno', 'Datil', 'Damasco'],
    e: ['Endrina', 'Espino amarillo'],
    f: ['Fresa', 'Frambuesa', 'Fruta de la pasion', 'Feijoa'],
    g: ['Guayaba', 'Granada', 'Guanabana', 'Grosella'],
    h: ['Higo', 'Higo chumbo'],
    i: ['Icaco', 'Ilama'],
    j: ['Jocote', 'Jujuba', 'Jaca'],
    l: ['Limon', 'Lima', 'Lulo', 'Lichi'],
    m: ['Manzana', 'Mango', 'Melon', 'Mandarina'],
    n: ['Naranja', 'Nectarina', 'Nispero', 'Nance'],
    o: ['Oliva', 'Oroblanco'],
    p: ['Pera', 'Pina', 'Papaya', 'Platano'],
    q: ['Quinoto', 'Quetembila'],
    r: ['Rambutan', 'Ruibarbo'],
    s: ['Sandia', 'Sapote', 'Sauco'],
    t: ['Tamarindo', 'Toronja', 'Tuna', 'Tomate de arbol'],
    u: ['Uva', 'Uchuva', 'Uva pasa'],
    v: ['Vainilla', 'Verbena'],
  },
  comida: {
    a: ['Arepa', 'Arroz', 'Albondigas', 'Asado'],
    b: ['Burrito', 'Bistec', 'Brocoli', 'Brownie'],
    c: ['Ceviche', 'Croqueta', 'Caldo', 'Churrasco'],
    d: ['Dona', 'Dulce de leche', 'Dorada'],
    e: ['Empanada', 'Ensalada', 'Espagueti', 'Estofado'],
    f: ['Fideos', 'Flan', 'Frijoles', 'Fajitas'],
    g: ['Galleta', 'Guiso', 'Guacamole', 'Gazpacho'],
    h: ['Hamburguesa', 'Helado', 'Huevo frito', 'Humus'],
    i: ['Infusion', 'Injera'],
    j: ['Jamon', 'Jalea', 'Jugo'],
    l: ['Lasana', 'Lentejas', 'Longaniza', 'Locro'],
    m: ['Milanesa', 'Macarrones', 'Mermelada', 'Mole'],
    n: ['Nachos', 'Napolitana', 'Natilla', 'Nuggets'],
    o: ['Omelette', 'Ostras', 'Ossobuco'],
    p: ['Pizza', 'Pasta', 'Paella', 'Pollo asado'],
    q: ['Quesadilla', 'Queso', 'Quiche', 'Quinoa'],
    r: ['Ravioles', 'Risotto', 'Ramen', 'Rosquilla'],
    s: ['Sopa', 'Sushi', 'Sandwich', 'Salchipapa'],
    t: ['Tacos', 'Tortilla', 'Tamal', 'Tarta'],
    u: ['Udon', 'Uvas pasas'],
    v: ['Verduras', 'Vinagreta', 'Volovan'],
  },
  profesion: {
    a: ['Abogado', 'Arquitecto', 'Actor', 'Astronauta'],
    b: ['Bombero', 'Biologo', 'Barbero', 'Bibliotecario'],
    c: ['Carpintero', 'Cocinero', 'Contador', 'Cirujano'],
    d: ['Doctor', 'Dentista', 'Disenador', 'Director'],
    e: ['Enfermero', 'Electricista', 'Escritor', 'Economista'],
    f: ['Farmaceutico', 'Fotografo', 'Fisico', 'Fontanero'],
    g: ['Geologo', 'Guardaespaldas', 'Guia turistico'],
    h: ['Herrero', 'Historiador', 'Higienista'],
    i: ['Ingeniero', 'Ilustrador', 'Interprete', 'Inspector'],
    j: ['Juez', 'Jardinero', 'Joyero', 'Periodista'],
    l: ['Locutor', 'Librero', 'Linguista'],
    m: ['Medico', 'Maestro', 'Mecanico', 'Musico'],
    n: ['Nutricionista', 'Notario', 'Navegante'],
    o: ['Odontologo', 'Oftalmologo', 'Obrero'],
    p: ['Profesor', 'Piloto', 'Policia', 'Pintor'],
    q: ['Quimico', 'Quiropractico'],
    r: ['Recepcionista', 'Reportero', 'Relojero'],
    s: ['Secretario', 'Soldador', 'Sastre', 'Sociologo'],
    t: ['Traductor', 'Taxista', 'Tecnico', 'Terapeuta'],
    u: ['Urologo', 'Urbanista'],
    v: ['Veterinario', 'Vendedor', 'Violinista'],
  },
  marca: {
    a: ['Apple', 'Adidas', 'Amazon', 'Audi'],
    b: ['BMW', 'Barbie', 'Bimbo', 'Bosch'],
    c: ['Coca-Cola', 'Canon', 'Chanel', 'Chevrolet'],
    d: ['Disney', 'Dell', 'Dior', 'Dove'],
    e: ['Epson', 'Energizer', 'Ebay'],
    f: ['Ford', 'Ferrari', 'Fanta', 'Fila'],
    g: ['Google', 'Gucci', 'Gatorade', 'Gillette'],
    h: ['Honda', 'Hyundai', 'HP', 'Huawei'],
    i: ['Ikea', 'Intel', 'IBM', 'Instagram'],
    j: ['Jeep', 'Jordan', 'JBL', 'Jaguar'],
    l: ['Lego', 'Lenovo', 'Levis', 'LG'],
    m: ['Microsoft', 'Mercedes', 'Motorola', 'Mazda'],
    n: ['Nike', 'Nintendo', 'Netflix', 'Nestle'],
    o: ['Oreo', 'Oral-B', 'Omega', 'Oppo'],
    p: ['Puma', 'Pepsi', 'PlayStation', 'Porsche'],
    q: ['Quaker', 'Quiksilver'],
    r: ['Reebok', 'Rolex', 'Renault', 'Ray-Ban'],
    s: ['Samsung', 'Sony', 'Spotify', 'Starbucks'],
    t: ['Toyota', 'Tesla', 'TikTok', 'Toshiba'],
    u: ['Uber', 'Under Armour', 'Unilever'],
    v: ['Visa', 'Volvo', 'Vans', 'Volkswagen'],
  },
  deporte: {
    a: ['Atletismo', 'Ajedrez', 'Alpinismo', 'Automovilismo'],
    b: ['Baloncesto', 'Boxeo', 'Beisbol', 'Badminton'],
    c: ['Ciclismo', 'Clavados', 'Críquet', 'Canotaje'],
    d: ['Danza deportiva', 'Decatlon'],
    e: ['Esgrima', 'Esqui', 'Escalada', 'Equitacion'],
    f: ['Futbol', 'Futsal', 'Fisicoculturismo'],
    g: ['Gimnasia', 'Golf', 'Gimnasia ritmica'],
    h: ['Hockey', 'Halterofilia', 'Handbol'],
    i: ['Ironman'],
    j: ['Judo', 'Jiu-jitsu'],
    l: ['Lucha libre', 'Lanzamiento de jabalina'],
    m: ['Motociclismo', 'Maraton', 'Montanismo'],
    n: ['Natacion', 'Natacion sincronizada'],
    o: ['Orientacion'],
    p: ['Patinaje', 'Padel', 'Polo', 'Paracaidismo'],
    q: ['Quidditch'],
    r: ['Rugby', 'Remo', 'Raquetbol'],
    s: ['Surf', 'Snowboard', 'Squash', 'Softbol'],
    t: ['Tenis', 'Taekwondo', 'Triatlon', 'Tiro con arco'],
    u: ['Ultimate frisbee'],
    v: ['Voleibol', 'Vela', 'Voley playa'],
  },
};

function resolveCategoryBucket(category: string): string | null {
  const norm = normalizeWord(category);
  if (DICT[norm]) return norm;
  if (norm.includes('pais') || norm.includes('ciudad') || norm.includes('lugar')) {
    return 'lugar';
  }
  if (norm.includes('nombre')) return 'nombre';
  if (norm.includes('apellido')) return 'apellido';
  if (norm.includes('animal')) return 'animal';
  if (norm.includes('cosa') || norm.includes('objeto')) return 'cosa';
  if (norm.includes('color')) return 'color';
  if (norm.includes('fruta')) return 'fruta';
  if (norm.includes('comida') || norm.includes('plato')) return 'comida';
  if (norm.includes('profesion') || norm.includes('oficio')) return 'profesion';
  if (norm.includes('marca')) return 'marca';
  if (norm.includes('deporte')) return 'deporte';
  return null;
}

/**
 * Returns a real Spanish word for (category, letter) instantly offline,
 * or asks the secure StopMind! backend for custom categories when available.
 */
export async function getWordHint(params: {
  category: string;
  letter: string;
  currentValue?: string;
}): Promise<string | null> {
  const { category, letter, currentValue = '' } = params;
  const normLetter = normalizeWord(letter).slice(0, 1);
  if (!normLetter) return null;

  const bucket = resolveCategoryBucket(category);
  if (bucket) {
    const options = DICT[bucket]?.[normLetter];
    if (options && options.length > 0) {
      const currentNorm = normalizeWord(currentValue);
      const filtered = options.filter((w) => normalizeWord(w) !== currentNorm);
      const pool = filtered.length > 0 ? filtered : options;
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }

  return fetchHintViaBackend({ category, letter });
}
