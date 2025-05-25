
import axios, { type AxiosResponse } from 'axios';
import { parse } from 'date-fns';

interface DrawSchedule {  [day: string]: { [time: string]: string };}

interface DrawResult {  draw_name: string;  date: string;  gagnants: number[];  machine?: number[];}

const DRAW_SCHEDULE: DrawSchedule = {  Lundi: {    '10H': 'Reveil',    '13H': 'Etoile',    '16H': 'Akwaba',    '18H15': 'Monday Special',  },  Mardi: {    '10H': 'La Matinale',    '13H': 'Emergence',    '16H': 'Sika',    '18H15': 'Lucky Tuesday',  },  Mercredi: {    '10H': 'Premiere Heure',    '13H': 'Fortune',    '16H': 'Baraka',    '18H15': 'Midweek',  },  Jeudi: {    '10H': 'Kado',    '13H': 'Privilege',    '16H': 'Monni',    '18H15': 'Fortune Thursday',  },  Vendredi: {    '10H': 'Cash',    '13H': 'Solution',    '16H': 'Wari',    '18H15': 'Friday Bonanza',  },  Samedi: {    '10H': 'Soutra',    '13H': 'Diamant',    '16H': 'Moaye',    '18H15': 'National',  },  Dimanche: {    '10H': 'Benediction',    '13H': 'Prestige',    '16H': 'Awale',    '18H15': 'Espoir',  },};

export async function fetchLotteryResults(month?: string): Promise<DrawResult[]> {
  const baseUrl = 'https://lotobonheur.ci/api/results';
  const url = month ? `${baseUrl}?month=${month}` : baseUrl;

  try {
    const response: AxiosResponse = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
        Referer: 'https://lotobonheur.ci/resultats',
      },
      timeout: 10000,
    });

    const resultsData = response.data;
    if (!resultsData.success) {
      throw new Error('Réponse API non réussie');
    }

    const drawsResultsWeekly = resultsData.drawsResultsWeekly;
    const validDrawNames = new Set<string>();
    Object.values(DRAW_SCHEDULE).forEach((day) => {
      Object.values(day).forEach((drawName) => validDrawNames.add(drawName));
    });

    const results: DrawResult[] = [];

    for (const week of drawsResultsWeekly) {
      for (const dailyResult of week.drawResultsDaily) {
        const dateStr = dailyResult.date;
        let drawDate: string;

        try {
          // Expects format like "Lundi 29/07"
          const parts = dateStr.split(' ');
          if (parts.length < 2) {
            console.warn(`Format de date inattendu : ${dateStr}`);
            continue;
          }
          const dayMonth = parts[1]; // Get "29/07"
          const [day, monthStr] = dayMonth.split('/');
          
          // The user's code hardcodes 2025. This might be intentional.
          // If current year is desired, logic would need to change here.
          const parsedDate = parse(`${day}/${monthStr}/2025`, 'dd/MM/yyyy', new Date());
          drawDate = parsedDate.toISOString().split('T')[0];
        } catch (e) {
          console.warn(`Format de date invalide : ${dateStr}, erreur : ${e}`);
          continue;
        }

        for (const draw of dailyResult.drawResults.standardDraws) {
          const drawName = draw.drawName;
          if (!validDrawNames.has(drawName) || (typeof draw.winningNumbers === 'string' && draw.winningNumbers.startsWith('.'))) {
            continue;
          }

          const winningNumbers = (typeof draw.winningNumbers === 'string' ? (draw.winningNumbers.match(/\d+/g) || []) : []).map(Number).slice(0, 5);
          const machineNumbers = (typeof draw.machineNumbers === 'string' ? (draw.machineNumbers?.match(/\d+/g) || []) : []).map(Number).slice(0, 5);

          if (winningNumbers.length === 5) {
            results.push({
              draw_name: drawName,
              date: drawDate,
              gagnants: winningNumbers,
              machine: machineNumbers.length > 0 ? machineNumbers : undefined, // Allow for draws without machine numbers or partial machine numbers if relevant
            });
          } else {
            console.warn(`Données incomplètes pour le tirage ${drawName} : numéros gagnants ${winningNumbers.length}, numéros machine ${machineNumbers.length}`);
          }
        }
      }
    }

    if (results.length === 0) {
      // It might be normal to have no results for a given month, so perhaps not an error always.
      // For now, keeping user's logic.
      console.warn('Aucun résultat de tirage valide trouvé pour la période spécifiée.');
      // throw new Error('Aucun résultat de tirage valide trouvé pour la période spécifiée.');
    }

    return results;

  } catch (error) {
    if (axios.isAxiosError(error)) {
        console.error(`Erreur Axios lors de la récupération de ${url}: ${error.message}`, error.toJSON());
    } else {
        console.error(`Erreur lors de la récupération de ${url}:`, error);
    }
    throw new Error('Échec de la récupération des résultats');
  }
}
