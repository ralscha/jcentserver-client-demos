package ch.rasc.tennisdelta;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import tools.jackson.databind.ObjectMapper;

import ch.rasc.jcentserverclient.CentrifugoServerApiClient;

@Service
public class TennisMatchService {

	private static final String CHANNEL = "tennis:centre-court";

	private static final DateTimeFormatter EVENT_TIME = DateTimeFormatter.ofPattern("HH:mm:ss")
		.withZone(ZoneId.systemDefault());

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	private final ObjectMapper objectMapper;

	private final Random random = new Random();

	private final AtomicLong sequence = new AtomicLong();

	private final Deque<Map<String, Object>> lastEvents = new ArrayDeque<>();

	private final String playerAName = "Mira Kovac";

	private final String playerBName = "Ana Torres";

	private final String playerACountry = "SUI";

	private final String playerBCountry = "ESP";

	private final List<int[]> completedSets = new ArrayList<>();

	private boolean autoplay = true;

	private boolean matchComplete;

	private int gamesA;

	private int gamesB;

	private int pointsA;

	private int pointsB;

	private int acesA;

	private int acesB;

	private int winnersA;

	private int winnersB;

	private int errorsA;

	private int errorsB;

	private int breakChancesA;

	private int breakChancesB;

	private int breakConvertedA;

	private int breakConvertedB;

	private int totalPointsA;

	private int totalPointsB;

	private int elapsedSeconds;

	private int shotClock = 25;

	private int pointNumber;

	private String server = this.playerAName;

	public TennisMatchService(CentrifugoServerApiClient centrifugoServerApiClient, ObjectMapper objectMapper) {
		this.centrifugoServerApiClient = centrifugoServerApiClient;
		this.objectMapper = objectMapper;
		seedEvents();
	}

	@Scheduled(fixedRate = 1000)
	public synchronized void heartbeat() {
		this.elapsedSeconds += 1;
		this.shotClock = Math.max(0, this.shotClock - 1);
		if (this.autoplay && !this.matchComplete && this.elapsedSeconds % 3 == 0) {
			playPoint();
		}
		publish();
	}

	public synchronized Map<String, Object> snapshot() {
		return buildSnapshot();
	}

	public synchronized void playPointAndPublish() {
		if (!this.matchComplete) {
			playPoint();
		}
		publish();
	}

	public synchronized void resetAndPublish() {
		this.completedSets.clear();
		this.lastEvents.clear();
		this.sequence.set(0);
		this.autoplay = true;
		this.matchComplete = false;
		this.gamesA = 0;
		this.gamesB = 0;
		this.pointsA = 0;
		this.pointsB = 0;
		this.acesA = 0;
		this.acesB = 0;
		this.winnersA = 0;
		this.winnersB = 0;
		this.errorsA = 0;
		this.errorsB = 0;
		this.breakChancesA = 0;
		this.breakChancesB = 0;
		this.breakConvertedA = 0;
		this.breakConvertedB = 0;
		this.totalPointsA = 0;
		this.totalPointsB = 0;
		this.elapsedSeconds = 0;
		this.shotClock = 25;
		this.pointNumber = 0;
		this.server = this.playerAName;
		seedEvents();
		publish();
	}

	public synchronized void setAutoplay(boolean autoplay) {
		this.autoplay = autoplay;
		addEvent("Tactical mode", autoplay ? "Autoplay resumed" : "Autoplay paused");
		publish();
	}

	private void playPoint() {
		this.pointNumber += 1;
		this.shotClock = 25;
		boolean winnerIsA = this.random.nextDouble() > 0.47;
		String winner = winnerIsA ? this.playerAName : this.playerBName;
		String loser = winnerIsA ? this.playerBName : this.playerAName;
		int rallyLength = 3 + this.random.nextInt(10);
		String outcome = pickOutcome();

		if (winnerIsA) {
			this.totalPointsA += 1;
		}
		else {
			this.totalPointsB += 1;
		}

		if ("ace".equals(outcome)) {
			if (winnerIsA) {
				this.acesA += 1;
			}
			else {
				this.acesB += 1;
			}
		}
		else if ("winner".equals(outcome) || "volley winner".equals(outcome)) {
			if (winnerIsA) {
				this.winnersA += 1;
			}
			else {
				this.winnersB += 1;
			}
		}
		else {
			if (winnerIsA) {
				this.errorsB += 1;
			}
			else {
				this.errorsA += 1;
			}
		}

		if (winnerIsA) {
			this.pointsA += 1;
		}
		else {
			this.pointsB += 1;
		}

		addEvent("Point " + this.pointNumber,
				winner + " wins a " + rallyLength + "-shot rally with a " + outcome + " against " + loser + ".");

		if (isBreakPointForReceiver()) {
			if (winnerIsA && !this.playerAName.equals(this.server)) {
				this.breakChancesA += 1;
			}
			if (!winnerIsA && !this.playerBName.equals(this.server)) {
				this.breakChancesB += 1;
			}
		}

		if (wonGame(this.pointsA, this.pointsB)) {
			this.gamesA += 1;
			if (!this.playerAName.equals(this.server)) {
				this.breakConvertedA += 1;
			}
			completeGame(this.playerAName);
		}
		else if (wonGame(this.pointsB, this.pointsA)) {
			this.gamesB += 1;
			if (!this.playerBName.equals(this.server)) {
				this.breakConvertedB += 1;
			}
			completeGame(this.playerBName);
		}
	}

	private void completeGame(String winner) {
		addEvent("Game", winner + " takes the game. Score is now " + this.gamesA + "-" + this.gamesB + ".");
		this.pointsA = 0;
		this.pointsB = 0;
		this.server = this.server.equals(this.playerAName) ? this.playerBName : this.playerAName;
		if (wonSet(this.gamesA, this.gamesB)) {
			this.completedSets.add(new int[] { this.gamesA, this.gamesB });
			addEvent("Set", winner + " closes the set " + this.gamesA + "-" + this.gamesB + ".");
			this.gamesA = 0;
			this.gamesB = 0;
			if (setsWonByA() == 2 || setsWonByB() == 2) {
				this.matchComplete = true;
				this.autoplay = false;
				addEvent("Match", winner + " wins the match.");
			}
		}
	}

	private int setsWonByA() {
		return (int) this.completedSets.stream().filter(set -> set[0] > set[1]).count();
	}

	private int setsWonByB() {
		return (int) this.completedSets.stream().filter(set -> set[1] > set[0]).count();
	}

	private boolean wonGame(int leader, int trailer) {
		return leader >= 4 && leader - trailer >= 2;
	}

	private boolean wonSet(int leader, int trailer) {
		return leader >= 6 && leader - trailer >= 2;
	}

	private boolean isBreakPointForReceiver() {
		if (this.playerAName.equals(this.server)) {
			return this.pointsB >= 3 && this.pointsB > this.pointsA;
		}
		return this.pointsA >= 3 && this.pointsA > this.pointsB;
	}

	private String pickOutcome() {
		double roll = this.random.nextDouble();
		if (roll < 0.15) {
			return "ace";
		}
		if (roll < 0.48) {
			return "winner";
		}
		if (roll < 0.72) {
			return "volley winner";
		}
		return "forced error";
	}

	private void addEvent(String title, String text) {
		Map<String, Object> event = new LinkedHashMap<>();
		event.put("id", title + "-" + System.nanoTime());
		event.put("title", title);
		event.put("text", text);
		event.put("at", EVENT_TIME.format(Instant.now()));
		this.lastEvents.addFirst(event);
		while (this.lastEvents.size() > 6) {
			this.lastEvents.removeLast();
		}
	}

	private void seedEvents() {
		addEvent("Warm-up", "Players are finishing their final serve routine.");
		addEvent("Broadcast", "Delta comparison is live. Watch both subscriptions diverge in wire size.");
	}

	private Map<String, Object> buildSnapshot() {
		Map<String, Object> snapshot = new LinkedHashMap<>();
		snapshot.put("sequence", this.sequence.incrementAndGet());
		snapshot.put("meta", Map.of("tournament", "Grand Tour Finals", "court", "Centre Court"));
		snapshot.put("players", Map.of("a", Map.of("name", this.playerAName, "country", this.playerACountry), "b",
				Map.of("name", this.playerBName, "country", this.playerBCountry)));

		List<Map<String, Integer>> sets = new ArrayList<>();
		for (int[] set : this.completedSets) {
			sets.add(Map.of("a", set[0], "b", set[1]));
		}

		Map<String, Object> scoreboard = new LinkedHashMap<>();
		scoreboard.put("sets", sets);
		scoreboard.put("currentGames", Map.of("a", this.gamesA, "b", this.gamesB));
		scoreboard.put("currentPoints",
				Map.of("a", pointLabel(this.pointsA, this.pointsB), "b", pointLabel(this.pointsB, this.pointsA)));
		scoreboard.put("server", this.server);
		scoreboard.put("pressureLabel", pressureLabel());
		if (this.matchComplete) {
			scoreboard.put("winner", setsWonByA() > setsWonByB() ? this.playerAName : this.playerBName);
		}
		snapshot.put("scoreboard", scoreboard);

		snapshot.put("clock", Map.of("elapsedSeconds", this.elapsedSeconds, "formatted",
				formatElapsed(this.elapsedSeconds), "shotClock", this.shotClock, "pointNumber", this.pointNumber));

		snapshot.put("stats",
				Map.of("Aces", this.acesA + " - " + this.acesB, "Winners", this.winnersA + " - " + this.winnersB,
						"Forced errors drawn", this.errorsB + " - " + this.errorsA, "Break points", breakLine(),
						"Total points", this.totalPointsA + " - " + this.totalPointsB, "Win probability",
						String.format("%d%% - %d%%", estimateWinProbability(true), estimateWinProbability(false))));

		snapshot.put("lastEvents", new ArrayList<>(this.lastEvents));

		int payloadBytes = measure(snapshot);
		snapshot.put("telemetry", Map.of("serverPayloadBytes", payloadBytes, "autoplay", this.autoplay));
		return snapshot;
	}

	private String breakLine() {
		return this.breakConvertedA + "/" + this.breakChancesA + " - " + this.breakConvertedB + "/"
				+ this.breakChancesB;
	}

	private int estimateWinProbability(boolean forPlayerA) {
		int base = 50 + (setsWonByA() - setsWonByB()) * 12 + (this.gamesA - this.gamesB) * 4
				+ (this.totalPointsA - this.totalPointsB);
		int playerAValue = Math.max(8, Math.min(92, base));
		return forPlayerA ? playerAValue : 100 - playerAValue;
	}

	private String pressureLabel() {
		if (this.matchComplete) {
			return "Match complete";
		}
		if (isBreakPointForReceiver()) {
			return "Break point pressure";
		}
		if (this.pointsA >= 3 && this.pointsB >= 3) {
			return "Extended deuce sequence";
		}
		return "No immediate pressure point";
	}

	private String pointLabel(int playerPoints, int opponentPoints) {
		if (playerPoints >= 3 && opponentPoints >= 3) {
			if (playerPoints == opponentPoints) {
				return "40";
			}
			if (playerPoints == opponentPoints + 1) {
				return "Ad";
			}
			if (opponentPoints == playerPoints + 1) {
				return "40";
			}
		}
		return switch (Math.min(playerPoints, 3)) {
			case 0 -> "0";
			case 1 -> "15";
			case 2 -> "30";
			default -> "40";
		};
	}

	private String formatElapsed(int seconds) {
		int minutes = seconds / 60;
		int remSeconds = seconds % 60;
		return String.format("%02d:%02d", minutes, remSeconds);
	}

	private int measure(Map<String, Object> snapshot) {
		return this.objectMapper.writeValueAsBytes(snapshot).length;
	}

	private void publish() {
		this.centrifugoServerApiClient.publication().publish(builder -> builder.channel(CHANNEL).data(buildSnapshot()));
	}

}