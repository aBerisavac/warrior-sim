<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <svg class="forge-art" viewBox="0 0 820 600" preserveAspectRatio="none" role="img" :aria-label="t('map.forgeAria')">
    <defs>
      <pattern id="forge-flagstone" width="44" height="36" patternUnits="userSpaceOnUse">
        <rect width="44" height="36" fill="#b3a38a"/>
        <path d="M0 0h44M0 36h44M22 0v18M0 18h44M0 18v18M44 18v18" stroke="#81745e" stroke-width="1.3" opacity=".43"/>
      </pattern>
      <pattern id="house-planks" width="34" height="42" patternUnits="userSpaceOnUse">
        <rect width="34" height="42" fill="#a98a65"/>
        <path d="M0 0h34M0 42h34M17 0v42" stroke="#775b40" stroke-width="1.5" opacity=".45"/>
      </pattern>
      <radialGradient id="forge-glow"><stop stop-color="#efae58" stop-opacity=".56"/><stop offset="1" stop-color="#efae58" stop-opacity="0"/></radialGradient>
      <radialGradient id="forge-fire"><stop stop-color="#ffdf80"/><stop offset=".58" stop-color="#e6873b"/><stop offset="1" stop-color="#89472d"/></radialGradient>
    </defs>
    <rect width="820" height="600" fill="#c7b897"/>
    <path d="M0 0h820v600H0z" fill="#c9bd9d"/>
    <path d="M22 46h776v504H22z" fill="#514638" stroke="#89785c" stroke-width="8"/>
    <path d="M38 62h474v472H38z" fill="url(#forge-flagstone)"/>
    <path d="M526 62h256v170H526zM526 246h256v136H526zM526 396h256v138H526z" fill="url(#house-planks)"/>
    <path d="M514 46v62m0 52v125m0 54v195M514 238h89m54 0h141M514 389h95m49 0h140" fill="none" stroke="#574532" stroke-width="14" stroke-linecap="square"/>
    <path d="M512 107q53 2 53 53M512 285q49 0 49 54M603 238q0 48 54 48M609 389q0-45 49-45" fill="none" stroke="#846747" stroke-width="3" stroke-dasharray="5 5"/>
    <path d="M365 534h92" stroke="#4b3b2d" stroke-width="15"/>
    <path d="M365 534q0-74 92-74" fill="none" stroke="#9b7851" stroke-width="3" stroke-dasharray="6 5"/>
    <path d="M142 47h82m456 0h61" stroke="#d1bb84" stroke-width="9"/>
    <path d="M142 51h82m456 0h61" stroke="#493f34" stroke-width="3"/>
    <text x="57" y="91" class="room-label">{{ t('forgeHouse.forgeRoom') }}</text>
    <text x="542" y="89" class="room-label">{{ t('forgeHouse.warehouseRoom') }}</text>
    <text x="542" y="274" class="room-label">{{ t('forgeHouse.fatherRoom') }}</text>
    <text x="542" y="423" class="room-label">{{ t('forgeHouse.sonRoom') }}</text>

    <!-- Furnace and its working hearth -->
    <circle cx="158" cy="183" r="119" fill="url(#forge-glow)"/>
    <path d="M91 123h135v127H91z" fill="#5c5043" stroke="#413a33" stroke-width="8"/>
    <path d="M106 139h105v80H106z" fill="#312d2a"/>
    <ellipse cx="158" cy="196" rx="43" ry="29" fill="url(#forge-fire)"/>
    <path d="M132 200q-16-30 8-47-4 21 15 29 4-37 20-40-2 27 15 50" fill="#e89842"/>
    <path d="M147 200q-5-17 10-31 4 19 17 31" fill="#fbd980"/>
    <path d="M82 247h153l16 20H67z" fill="#75624d" stroke="#4b4035" stroke-width="5"/>
    <path d="M104 115V94h111v21" fill="#726755" stroke="#554b3d" stroke-width="5"/>
    <path d="M238 185h26m-13-13v26" stroke="#5f5443" stroke-width="7"/>
    <text x="97" y="290" class="object-label">{{ t('forgeHouse.furnace') }}</text>

    <!-- Workbench and smithing tools -->
    <rect x="75" y="330" width="146" height="45" rx="3" fill="#77583b" stroke="#4b382a" stroke-width="6"/>
    <path d="M91 375v62m115-62v62" stroke="#57422f" stroke-width="13"/>
    <path d="M103 344l30 18m49-19 21 17M159 337l-10 30" stroke="#a7a499" stroke-width="7" stroke-linecap="round"/>
    <path d="M100 406h107" stroke="#6b563e" stroke-width="5"/>
    <text x="86" y="465" class="object-label">{{ t('forgeHouse.workbench') }}</text>
    <path d="M269 363h130l-25 33H292z" fill="#4e5655" stroke="#333c3d" stroke-width="6"/>
    <path d="M302 394h65l17 69h-98z" fill="#65706b" stroke="#3b4847" stroke-width="6"/>
    <path d="M288 354h101" stroke="#8b9790" stroke-width="9" stroke-linecap="round"/>
    <path d="M287 462h100" stroke="#46504d" stroke-width="7"/>
    <text x="294" y="490" class="object-label">{{ t('forgeHouse.anvil') }}</text>

    <!-- Quenching zone, with reserved positions beside the water barrel -->
    <rect x="403" y="86" width="80" height="286" rx="8" fill="#86775d" opacity=".4"/>
    <circle cx="445" cy="163" r="35" fill="#5a4434" stroke="#3c3029" stroke-width="6"/>
    <circle cx="445" cy="163" r="27" fill="#577a7b" stroke="#c2ad79" stroke-width="5"/>
    <path d="M427 159q17-10 35 0m-28 11q10 5 22 0" fill="none" stroke="#adc5bc" stroke-width="3" opacity=".8"/>
    <text x="403" y="214" class="object-label">{{ t('forgeHouse.waterShort') }}</text>
    <circle cx="445" cy="294" r="35" fill="#82765e" fill-opacity=".28" stroke="#7d7057" stroke-width="4" stroke-dasharray="7 5"/>
    <circle cx="445" cy="294" r="23" fill="none" stroke="#82765e" stroke-width="2" stroke-dasharray="6 5"/>
    <text x="411" y="349" class="object-label">{{ t('forgeHouse.oilShort') }}</text>

    <!-- Warehouse: timber racks, coal sacks, and metal stock -->
    <rect x="547" y="107" width="183" height="24" fill="#71563a" stroke="#543f2d" stroke-width="4"/>
    <rect x="547" y="185" width="183" height="19" fill="#71563a" stroke="#543f2d" stroke-width="4"/>
    <rect x="558" y="135" width="30" height="42" fill="#9d8560" stroke="#6d573e" stroke-width="3"/>
    <rect x="592" y="140" width="31" height="37" fill="#8b7051" stroke="#6d573e" stroke-width="3"/>
    <path d="M639 179l7-39h25l7 39zM680 179l7-39h25l7 39z" fill="#9e9377" stroke="#6c604d" stroke-width="3"/>
    <path d="M554 209h85m-72-8v18m26-18v18m26-18v18" stroke="#525853" stroke-width="7"/>
    <path d="M670 214q8-22 23-18 21 3 25 22z" fill="#393932" stroke="#62594a" stroke-width="4"/>
    <circle cx="682" cy="207" r="5" fill="#222923"/><circle cx="698" cy="204" r="5" fill="#222923"/>
    <text x="664" y="230" class="object-label">{{ t('forgeHouse.coal') }}</text>

    <!-- Father’s private sleeping room -->
    <rect x="653" y="284" width="105" height="69" rx="7" fill="#71523e" stroke="#49392f" stroke-width="7"/>
    <rect x="658" y="292" width="96" height="50" rx="3" fill="#849077"/>
    <rect x="659" y="292" width="27" height="49" rx="4" fill="#dfccb0"/>
    <path d="M689 293v50" stroke="#d0be9a" stroke-width="3"/>
    <rect x="549" y="302" width="49" height="37" fill="#806044" stroke="#55402f" stroke-width="5"/>
    <circle cx="572" cy="320" r="8" fill="#c8b684"/>
    <path d="M555 355h55" stroke="#6f563b" stroke-width="8"/>
    <text x="653" y="374" class="object-label">{{ t('forgeHouse.fatherBed') }}</text>

    <!-- Son’s room has a smaller bed, chest, and a window -->
    <rect x="646" y="435" width="111" height="68" rx="7" fill="#75543e" stroke="#49392f" stroke-width="7"/>
    <rect x="651" y="441" width="101" height="51" rx="3" fill="#738873"/>
    <rect x="651" y="441" width="27" height="50" rx="4" fill="#e6d1ae"/>
    <path d="M680 441v51" stroke="#bbcaaf" stroke-width="3"/>
    <rect x="546" y="465" width="54" height="42" rx="3" fill="#8f6c45" stroke="#573d2d" stroke-width="5"/>
    <path d="M546 477h54m-27-12v42" stroke="#c4a76b" stroke-width="4"/>
    <circle cx="575" cy="486" r="3" fill="#e1ca87"/>
    <text x="651" y="524" class="object-label">{{ t('forgeHouse.sonBed') }}</text>

    <text x="56" y="519" class="plan-caption">{{ t('forgeHouse.planCaption') }}</text>
  </svg>
</template>

<style scoped>
.room-label{fill:#514331;font:700 15px Georgia,serif;letter-spacing:1px;text-transform:uppercase}
.object-label{fill:#534a38;font:700 11px Georgia,serif;letter-spacing:.5px}
.plan-caption{fill:#615740;font:italic 12px Georgia,serif}
</style>
