package ch.rasc.iss;

import org.springframework.web.service.annotation.GetExchange;

import com.fasterxml.jackson.annotation.JsonProperty;

public interface IssNotifyClient {

	public final static String ISS_NOTIFY_URL = "http://api.open-notify.org";

	record Position(String longitude, String latitude) {
	}

	record IssNotify(String message, @JsonProperty("iss_position") Position position, long timestamp) {
	}

	@GetExchange("/iss-now.json")
	IssNotify issNow();

}
