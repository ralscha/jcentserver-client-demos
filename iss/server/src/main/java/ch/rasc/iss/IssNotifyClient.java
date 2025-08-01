/*
 * Copyright the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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
