package ch.rasc.demo.snake;

import java.awt.Color;
import java.util.concurrent.ThreadLocalRandom;

public class SnakeUtils {

	public static final int PLAYFIELD_WIDTH = 640;

	public static final int PLAYFIELD_HEIGHT = 480;

	public static final int GRID_SIZE = 10;

	public static String getRandomHexColor() {
		ThreadLocalRandom random = ThreadLocalRandom.current();
		float hue = random.nextFloat();
		// sat between 0.1 and 0.3
		float saturation = (random.nextInt(2000) + 1000) / 10000f;
		float luminance = 0.9f;
		Color color = Color.getHSBColor(hue, saturation, luminance);
		return '#' + Integer.toHexString((color.getRGB() & 0xffffff) | 0x1000000).substring(1);
	}

	public static Location getRandomLocation() {
		ThreadLocalRandom random = ThreadLocalRandom.current();
		int x = random.nextInt(PLAYFIELD_WIDTH / GRID_SIZE) * GRID_SIZE;
		int y = random.nextInt(PLAYFIELD_HEIGHT / GRID_SIZE) * GRID_SIZE;
		return new Location(x, y);
	}

}
