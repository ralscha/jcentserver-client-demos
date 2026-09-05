package ch.rasc.whiteboard;

import java.util.Set;

public record DrawingMessage(double x0, double y0, double x1, double y1, String color) {

	private static final Set<String> COLORS = Set.of("black", "red", "green", "blue", "yellow");

	public DrawingMessage {
		if (!validCoordinate(x0) || !validCoordinate(y0) || !validCoordinate(x1) || !validCoordinate(y1)) {
			throw new IllegalArgumentException("drawing coordinates must be between 0 and 1");
		}
		if (!COLORS.contains(color)) {
			throw new IllegalArgumentException("unsupported drawing color");
		}
	}

	private static boolean validCoordinate(double coordinate) {
		return Double.isFinite(coordinate) && coordinate >= 0 && coordinate <= 1;
	}
}
